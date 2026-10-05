// Die Bildschirme nach den Angaben: Prüfung, Ergebnis, Paket, Limit, Vertrag,
// Unterschrift, Zahlung, Danke (PIN: pin.tsx). Wortlaut aus dem freigegebenen
// Prototyp v2 — mit echten Daten, echter Prüfung, echter Annahme und Zahlung.
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ANTRAG_NEU_HAKEN_GEPRUEFT, ANTRAG_NEU_PAKETE, ANTRAG_NEU_WERBE_HINWEIS, ANTRAG_NEU_SOFORT_OHNE, ANTRAG_NEU_SOFORT_TEXT, OHNE_ABFRAGE, ZWECK_TEXT,
  agbDatum, antragNeuLuecke, geburtText, type Zweck,
} from "@shared/fiaon-antrag-neu";
import { paketPreisCents } from "@shared/fiaon-pakete";
import { AGB_FASSUNG } from "@shared/fiaon-vertrag-paket";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { BANK } from "@shared/fiaon-bank";
import { KARTE_LINK_SATZ } from "@shared/fiaon-karten-weg";
import { BANK_SATZ, FUSS_SATZ, KNOPF_ZAHLUNGSPFLICHTIG, KUENDIGUNG_ZEILE } from "@/components/antrag/bestelluebersicht-daten";
import { buildEpcQrPayload } from "@/lib/epc-qr";
import { messungsDaten, metaEreignis, META_EREIGNIS } from "@/lib/werbung";
import { META_PAKETWECHSEL } from "@shared/fiaon-meta-ereignisse";
import { Akk, Fehlerkasten, Guilloche, Haken, Ico, Knopf, Lead, Pfeil, Seg, Siegel, Tipp, Tippbar, Titel, Zeile, useAntrag, useFehler } from "./bausteine";
import { api } from "./api";
import {
  anredeDativ, anredeKurz, anschriftText, datenAus, datenZeilen, datum, euro, kartenName, mitWem, naechstesPaket, paket, paketIndex, telefonText, uhr, zustandVergessen,
  type PruefPunkt, type Zustand,
} from "./zustand";
import { AngabenSheet, AuskunftSheet, LeistungSheet, PasswortSheet, QrSheet, TerminWahl, VertragSheet } from "./sheets";

const rate = (key: string) => paketPreisCents(key) / 100;

// ═══════════════════════════════════════════════════════════════════════════
// Prüfung — die Punkte kommen vom Server; die Animation wartet auf sie.
// ═══════════════════════════════════════════════════════════════════════════
const PUNKT_TITEL = ["Angaben", "Anschrift", "Telefon", "E-Mail", "Einkommen", "Ausgangslage", "Kein Doppelvertrag", "Profil"];

export function SchrittPruefung() {
  const { S, setze, gehe, buehne, ruhig, sitzung, lichtStreif, orbitBox, buehnenBox, toast } = useAntrag();
  const [liste, setListe] = useState<PruefPunkt[]>([]);
  const [fertigZahl, setFertigZahl] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [versuch, setVersuch] = useState(0);
  const aktuell = useRef(S);
  aktuell.current = S;

  useEffect(() => {
    let weg = false;
    const zeiten: number[] = [];
    const o = orbitBox();
    const box = buehnenBox();
    setListe([]); setFertigZahl(0); setFehler(null);

    // Der Orbit: acht Kacheln kreisen um die Karte, jede erledigte fliegt in die Karte.
    let stopOrbit = () => {};
    if (o && box) {
      const r = box.getBoundingClientRect();
      const rad = Math.min(r.width * 0.42, 260), ry = Math.min(r.height * 0.4, rad * 0.6);
      // Der Ring beginnt oben und läuft im Uhrzeigersinn (Pfad statt gedrehter Ellipse — eine um 90° gedrehte
      // Ellipse stünde hochkant).
      const cx0 = rad + 10, cy0 = ry + 10;
      const pfad = `M ${cx0} ${cy0 - ry} A ${rad} ${ry} 0 1 1 ${cx0} ${cy0 + ry} A ${rad} ${ry} 0 1 1 ${cx0} ${cy0 - ry}`;
      o.innerHTML = `<svg width="${rad * 2 + 20}" height="${ry * 2 + 20}" viewBox="0 0 ${rad * 2 + 20} ${ry * 2 + 20}"><ellipse cx="${cx0}" cy="${cy0}" rx="${rad}" ry="${ry}" fill="none" stroke="rgba(29,78,216,.22)" stroke-width="1.2" stroke-dasharray="2 7"/><path class="an-ring" d="${pfad}" fill="none" stroke="#288DFA" stroke-width="2" stroke-linecap="round" style="transition:stroke-dashoffset .6s cubic-bezier(.22,1,.36,1),opacity .6s"/></svg>`
        + PUNKT_TITEL.map((t, i) => `<div class="an-orbit-kachel" data-i="${i}"><i></i>${t}</div>`).join("");
      const ringPfad = o.querySelector<SVGPathElement>(".an-ring");
      const umfang = ringPfad?.getTotalLength?.() || Math.PI * (3 * (rad + ry) - Math.sqrt((3 * rad + ry) * (rad + 3 * ry)));
      if (ringPfad) { ringPfad.style.strokeDasharray = `${umfang}`; ringPfad.style.strokeDashoffset = `${umfang}`; }
      o.hidden = false;
      const kacheln = Array.from(o.querySelectorAll<HTMLDivElement>(".an-orbit-kachel"));
      const masse = kacheln.map((k) => [k.offsetWidth, k.offsetHeight]);
      const t0 = performance.now();
      const raus: Record<number, number> = {};
      let aus = false;
      const lauf = (n: number) => {
        if (aus || weg) return;
        const rr = box.getBoundingClientRect();
        const cx = rr.width / 2, cy = rr.height / 2;
        const rot = ruhig() ? 0 : ((n - t0) / 4200) * Math.PI * 2;
        kacheln.forEach((k, i) => {
          const a = rot + (i * Math.PI * 2) / kacheln.length - Math.PI / 2;
          const [w, h] = masse[i];
          let x = Math.max(4, Math.min(rr.width - w - 4, cx + Math.cos(a) * rad - w / 2));
          let y = Math.max(2, Math.min(rr.height - h - 2, cy + Math.sin(a) * ry - h / 2));
          if (raus[i] != null) {
            const p = Math.min(1, (n - raus[i]) / 480), e = 1 - Math.pow(1 - p, 3);
            x += (cx - w / 2 - x) * e; y += (cy - h / 2 - y) * e;
            k.style.opacity = String(1 - e);
            k.style.transform = `translate(${x}px,${y}px) scale(${1 - 0.5 * e})`;
          } else k.style.transform = `translate(${x}px,${y}px)`;
        });
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
      (o as any)._raus = (i: number) => { raus[i] = performance.now(); kacheln[i]?.classList.add("an-ok"); };
      (o as any)._ring = (anteil: number) => { if (ringPfad) ringPfad.style.strokeDashoffset = String(umfang * (1 - anteil)); };
      stopOrbit = () => { aus = true; if (ringPfad) ringPfad.style.opacity = "0"; };
    }

    const schrittMs = ruhig() ? 120 : 640;
    const warte = (ms: number) => new Promise<void>((res) => zeiten.push(window.setTimeout(res, ms)));
    const z = aktuell.current;
    const anfrage = api.pruefen(z.ref!, datenAus(z), sitzung);

    (async () => {
      await warte(500);
      const r = await anfrage;
      if (weg) return;
      if (!r.ok || !(r.json as any)?.punkte) {
        stopOrbit();
        const j: any = r.json;
        if (j?.zurueck?.schritt) {
          toast(j.zurueck.meldung || "Bitte prüfen Sie diese Angabe.");
          gehe(j.zurueck.schritt, { richtung: "zurueck", hinweis: { feld: j.zurueck.feld, text: j.zurueck.meldung } });
          return;
        }
        setFehler(j?.error || "Die Prüfung konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es gleich noch einmal.");
        return;
      }
      const punkte: PruefPunkt[] = (r.json as any).punkte;
      const doppelt = !!(r.json as any).doppelt;
      for (let i = 0; i < punkte.length; i++) {
        if (weg) return;
        setListe((l) => [...l, punkte[i]]);
        setFertigZahl(i + 1);
        const ob: any = orbitBox();
        ob?._ring?.((i + 1) / punkte.length);
        zeiten.push(window.setTimeout(() => { ob?._raus?.(i); buehne()?.nameNeu(); }, 220));
        await warte(schrittMs);
      }
      await warte(300);
      if (weg) return;
      setze({ geprueftAm: doppelt ? null : (r.json as any).geprueftAm, pruefPunkte: punkte, doppelt });
      const b = buehne();
      if (b && !ruhig() && !doppelt) { b.drehen(); zeiten.push(window.setTimeout(() => { lichtStreif(); b.warmLicht(); }, 380)); }
      await warte(ruhig() ? 200 : 1250);
      if (weg) return;
      stopOrbit();
      gehe("ergebnis", { ersetzen: true });
    })();

    return () => {
      weg = true;
      zeiten.forEach((t) => clearTimeout(t));
      stopOrbit();
      if (o) { o.innerHTML = ""; o.hidden = true; }
    };
  }, [versuch]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = PUNKT_TITEL.length;
  return (
    <>
      <Titel text="Wir prüfen Ihren Antrag." />
      <Lead>Einen Moment – wir gleichen Ihre Angaben ab und erstellen Ihr Profil.</Lead>
      {fehler ? <Fehlerkasten text={fehler} knopf="Noch einmal prüfen" onKnopf={() => setVersuch((v) => v + 1)} /> : null}
      <div className="an-pruef-fortschritt">
        <div className="an-pruef-balken"><i style={{ width: `${(fertigZahl / n) * 100}%` }} /></div>
        <div className="an-pruef-zahl">{fertigZahl} von {n} geprüft</div>
      </div>
      <ul className="an-pruef-liste" aria-live="polite">
        {liste.map((p) => (
          <li key={p.id} style={p.ok ? undefined : { color: "var(--bernstein)" }}><Tippbar text={p.text} tag="span" ms={9} /></li>
        ))}
      </ul>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Ergebnis — „Herzlichen Glückwunsch … Ihr Antrag ist bestätigt"
// (bewusst nicht „Bonität genehmigt": FIAON fragt bei keiner Auskunftei an, AGB § 9)
// ═══════════════════════════════════════════════════════════════════════════
export function SchrittErgebnis() {
  const { S, gehe, buehne, ruhig } = useAntrag();
  const [siegel, setSiegel] = useState(false);
  const [tippen, setTippen] = useState(false);
  useEffect(() => {
    const a = window.setTimeout(() => { setSiegel(true); buehne()?.funkeln(); }, ruhig() ? 0 : 650);
    const b = window.setTimeout(() => setTippen(true), ruhig() ? 0 : 900);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (S.doppelt) {
    return (
      <>
        <Titel text={`Sie sind bereits bei FIAON${anredeKurz(S)}.`} />
        <Lead>Auf Ihren Namen läuft schon ein FIAON-Vertrag. Einen zweiten brauchen Sie nicht – in Ihrem Kundenbereich sehen Sie Ihren Stand und können Ihr Paket wechseln.</Lead>
        <div className="an-knoepfe">
          <a className="an-knopf an-haupt" href={`/app/login?email=${encodeURIComponent(S.email)}`}>Zu meinem Kundenbereich<Pfeil /></a>
          <a className="an-knopf an-text" style={{ alignSelf: "center" }} href="/kontakt">Fragen? Schreiben Sie uns.</a>
        </div>
      </>
    );
  }
  const am = S.geprueftAm ? new Date(S.geprueftAm) : new Date();
  const geburt = geburtText(S);
  const text = `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, bestätigt den Eingang und die Vollständigkeit des Antrags von ${(anredeDativ(S) + kartenName(S)).trim() || "Ihnen"}`
    + (geburt ? `, geboren am ${geburt}` : "") + (anschriftText(S) ? `, wohnhaft ${anschriftText(S)}` : "")
    + `. Mit Ihrer Unterschrift wird daraus Ihr Vertrag. Ihr Profil wurde aus Ihren Angaben erstellt – ${OHNE_ABFRAGE[S.land]}, ohne Einfluss auf Ihren Score. Geprüft am ${datum(am)} um ${uhr(am)} Uhr · Vorgang ${S.ref ?? ""}.`;
  return (
    <>
      <div className="an-glueck">
        <span className="an-ueber">Herzlichen Glückwunsch</span>
        <Titel text={`Ihr Antrag ist bestätigt${anredeKurz(S)}.`} />
        <p className="an-willkommen">Herzlich willkommen bei FIAON.</p>
      </div>
      <div className="an-urkunde">
        <Guilloche />
        <Siegel an={siegel} />
        <h2>Bestätigung Ihres Antrags</h2>
        {tippen ? <Tippbar text={text} klasse="an-amtlich" tag="p" ms={11} /> : <p className="an-amtlich" aria-hidden="true" style={{ visibility: "hidden" }}>{text}</p>}
      </div>
      <div className="an-feld">
        <span className="an-etikett">Ihr Weg zur Karte</span>
        <ol className="an-weg">
          <li data-n="1"><span><b>Vertrag annehmen</b>Digital, mit Ihrer Unterschrift.</span></li>
          <li data-n="2"><span><b>FIAON-Konto aktivieren</b>Mit Ihrer ersten Monatsrate prüfen wir die Verifizierung per Namensabgleich und aktivieren Ihr FIAON-Konto direkt bei Eingang.</span></li>
          <li data-n="3"><span><b>Ihre Karte</b>Nach der Aktivierung und der Zusage der Bank ist Ihre Karte in der Regel in 2–5 Werktagen bei Ihnen. Online nutzen Sie sie in der Regel sofort nach der Freigabe durch die Bank – auch mit Apple Pay und Google Pay.</span></li>
        </ol>
      </div>
      <Knopf text={S.pinGesetzt ? "Paket und Limit wählen" : "Persönliche PIN festlegen"} onClick={() => gehe(S.pinGesetzt ? "paket" : "pin")} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Paket — das Kartendeck (Wischen, Pfeile), Limit groß, Preis leise
// ═══════════════════════════════════════════════════════════════════════════
export function SchrittPaket() {
  const { S, gehe, deckIndex, deckGehe, paketWaehlen, oeffneSheet, speichern, ereignis } = useAntrag();
  const i = deckIndex;
  const P = ANTRAG_NEU_PAKETE[i] ?? ANTRAG_NEU_PAKETE[1];
  const N = ANTRAG_NEU_PAKETE[i + 1] ?? null;
  const los = () => {
    const teil = paketWaehlen(P.key);
    ereignis("paket", { schritt: "paket", detail: P.key });
    void speichern("paket", teil);
    gehe(S.rueckZu === "vertrag" || S.rueckZu === "unterschrift" ? "limit" : "limit");
  };
  return (
    <>
      <Titel text="Wählen Sie Ihr Paket." />
      <Lead>Wischen Sie durch die Karten – auf jeder steht schon Ihr Name.</Lead>
      <div className="an-paket-info" aria-live="polite">
        <div className="an-paket-kopf"><h2 className="an-paket-name">{P.name}</h2><span className="an-paket-beisatz">{P.beisatz}</span></div>
        <div className="an-limit-anzeige">
          <small>Ziel-Limit</small>
          <b>bis {euro(P.bis, false)}</b>
          <span className="an-preis-leise">{P.name} · {euro(rate(P.key))} im Monat · 12 Monate · zusammen {euro(rate(P.key) * 12)}</span>
          <span className="an-preis-leise">Ihr Ziel. {BANK_SATZ}</span>
        </div>
        <button type="button" className="an-knopf an-text" style={{ alignSelf: "flex-start" }} onClick={() => { ereignis("leistungen_angesehen", { schritt: "paket", detail: P.key }); oeffneSheet(<LeistungSheet P={P} />); }}>
          Alles, was enthalten ist
        </button>
        {N ? (
          <button type="button" className="an-pitch" onClick={() => { ereignis("upgrade_angeboten", { schritt: "paket", detail: N.key }); deckGehe(i + 1); }}>
            <span>Oder lieber auf ein Ziel bis <b>{euro(N.bis, false)}</b> hinarbeiten – mit {N.name}?</span><Pfeil />
          </button>
        ) : null}
      </div>
      <Knopf text={<>Weiter mit {P.name}</>} onClick={los} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Limit und Nutzung
// ═══════════════════════════════════════════════════════════════════════════
export function SchrittLimit() {
  const { S, setze, weiter, speichern, weiterText, toast, buehne, paketWaehlen, ereignis, ruhig } = useAntrag();
  const f = useFehler("limit");
  const P = paket(S.paket);
  const N = naechstesPaket(S.paket);
  const zahl = useRef<HTMLDivElement>(null);
  const lauf = useRef(0);
  const zaehlen = useCallback((ziel: number) => {
    const el = zahl.current;
    if (!el) return;
    if (ruhig()) { el.textContent = euro(ziel, false); return; }
    const mein = ++lauf.current;
    const start = parseInt((el.textContent || "0").replace(/\D/g, ""), 10) || 0;
    const t0 = performance.now();
    const schritt = (n: number) => {
      if (mein !== lauf.current) return;
      const p = Math.min(1, (n - t0) / 700), e = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = euro(p >= 1 ? ziel : Math.round(start + (ziel - start) * e), false);
      if (p < 1) requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
  }, [ruhig]);
  const zweck = (k: Zweck) => {
    const an = S.zweck.includes(k);
    setze({ zweck: an ? S.zweck.filter((x) => x !== k) : [...S.zweck, k] });
    f.weg("zweck");
  };
  const los = () => {
    if (!S.zweck.length) return f.zeigen("zweck", "Bitte wählen Sie mindestens einen Verwendungszweck.");
    ereignis("limit", { schritt: "limit", detail: S.limit });
    void speichern("limit");
    weiter();
  };
  return (
    <>
      <Titel text="Mit welchem Limit möchten Sie starten?" />
      <Lead>Ihr Start-Limit steht als Ihr Ziel in Ihrem Vertrag. Mit {P.name}.</Lead>
      <div className="an-zahl-gross" ref={zahl}>{euro(S.limit, false)}</div>
      <p className="an-klein" style={{ margin: "-4px 0 0" }}>{BANK_SATZ}</p>
      <div className="an-raster an-drei" role="radiogroup" data-feld="limitwahl" aria-label="Start-Limit">
        {P.limits.map((c, i) => (
          <button key={c} type="button" className="an-kachel an-limit-kachel" role="radio" aria-checked={S.limit === c} aria-pressed={S.limit === c}
            onClick={() => { if (S.limit !== c) { setze({ limit: c, ag3: false }); zaehlen(c); } }}>
            <b>{euro(c, false)}</b><small>{i === 2 ? "höchstes Ziel" : i === 1 ? "ausgewogen" : "zum Einstieg"}</small>
          </button>
        ))}
      </div>
      {N ? (
        <button type="button" className="an-pitch" onClick={() => {
          ereignis("upgrade_angeboten", { schritt: "limit", detail: N.key });
          const teil = paketWaehlen(N.key, N.limits[1]);
          buehne()?.funkeln();
          zaehlen(N.limits[1]);
          metaEreignis(META_PAKETWECHSEL, `${S.ref}.${N.key}`, { content_name: N.name, value: rate(N.key) });
          void speichern("limit", teil);
          toast(`Sie sind jetzt bei ${N.name} · ${euro(rate(N.key))} im Monat · 12 Monate · zusammen ${euro(rate(N.key) * 12)}.`);
        }}>
          <span>Oder lieber auf ein Ziel bis <b>{euro(N.bis, false)}</b> hinarbeiten – mit {N.name}?</span><Pfeil />
        </button>
      ) : null}
      <div className="an-feld">
        <span className="an-etikett">Wofür nutzen Sie die Karte? <span className="an-klein">· mehrere möglich</span></span>
        <div className={`an-raster an-drei${f.bei("zweck") ? " an-fehlt" : ""}`} data-feld="zweck">
          {(Object.keys(ZWECK_TEXT) as Zweck[]).map((k) => (
            <button key={k} type="button" className="an-kachel" aria-pressed={S.zweck.includes(k)} onClick={() => zweck(k)}>
              <Ico name={k} /><span className="an-haken-k" /><span>{ZWECK_TEXT[k]}</span>
            </button>
          ))}
        </div>
        {f.bei("zweck") ? <Tipp text={f.bei("zweck")!} /> : null}
      </div>
      <Knopf text={weiterText("Weiter zum Vertrag")} onClick={los} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Vertrag — alles, was gilt; erst der Knopf auf der nächsten Seite schließt ihn
// ═══════════════════════════════════════════════════════════════════════════
export function SchrittVertrag() {
  const { S, setze, gehe, weiter, oeffneSheet, ereignis } = useAntrag();
  const P = paket(S.paket);
  const r = rate(S.paket);
  return (
    <>
      <Titel text={`Ihr Vertrag${anredeKurz(S)}.`} />
      <Lead>Hier steht alles, was gilt. Erst der Knopf auf der nächsten Seite schließt den Vertrag.</Lead>
      <div className="an-vertragskarte">
        <Guilloche />
        <h2>FIAON-Vertrag · {P.name}</h2>
        <p className="an-ziel">Ihr Ziel: die eigene Visa-Kreditkarte · Start-Limit {euro(S.limit, false)}</p>
        <div className="an-akkordeon">
          <Akk titel="Ihre Angaben">
            <dl className="an-datenliste">{datenZeilen(S).map(([a, b]) => <Fragment key={a}><dt>{a}</dt><dd>{b}</dd></Fragment>)}</dl>
            <button type="button" className="an-knopf an-text" style={{ marginTop: 6 }} onClick={() => oeffneSheet(<AngabenSheet />)}>Angaben ändern</button>
          </Akk>
          <Akk titel="Was FIAON für Sie tut" offen>
            <p style={{ margin: "0 0 8px" }}>{P.intro}</p>
            <ol className="an-nummern">{P.leistungen.map((l) => <li key={l}><span>{l}</span></li>)}</ol>
          </Akk>
          <Akk titel="Kosten und Laufzeit">
            <p style={{ margin: 0 }}>{euro(r)} im Monat, zinsfrei, Laufzeit zwölf Monate (zusammen {euro(r * 12)}). Zahlung per Überweisung. Die erste Monatsrate ist mit Vertragsschluss fällig, die weiteren jeweils monatlich.</p>
          </Akk>
          <Akk titel="Kündigung"><p style={{ margin: 0 }}>{KUENDIGUNG_ZEILE}</p></Akk>
          <Akk titel="Ihr Widerrufsrecht">
            <p style={{ margin: 0 }}>Sie können den Vertrag binnen vierzehn Tagen ohne Angabe von Gründen widerrufen. Eine kurze Nachricht an FIAON genügt. Die vollständige Widerrufsbelehrung und das Muster-Widerrufsformular stehen im Vertrag und kommen mit Ihrer Vertragsbestätigung.</p>
          </Akk>
        </div>
        <div className="an-knoepfe" style={{ marginTop: 12 }}>
          <button type="button" className="an-knopf an-leise" onClick={() => { ereignis("vertrag_gelesen", { schritt: "vertrag", detail: "ganz" }); oeffneSheet(<VertragSheet />); }}>Vollständigen Vertrag lesen</button>
          <button type="button" className="an-knopf an-text" style={{ alignSelf: "center" }} onClick={() => { setze({ rueckZu: "vertrag" }); gehe("paket", { richtung: "zurueck" }); }}>Paket ändern</button>
        </div>
      </div>
      <Knopf text="Weiter zur Unterschrift" onClick={weiter} />
      <button type="button" className="an-knopf an-text" style={{ alignSelf: "center" }} onClick={() => oeffneSheet(<TerminWahl art="vorher" />)}>Fragen? Wir rufen Sie zurück.</button>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Unterschrift und Annahme
// ═══════════════════════════════════════════════════════════════════════════
type Strich = [number, number, number][];

function Unterschriftsfeld({ onAenderung, getippterName, sperren }: { onAenderung: (o: { da: boolean; getippt: boolean; png: () => string | null }) => void; getippterName: string; sperren: boolean }) {
  const { buehne, ereignis } = useAntrag();
  const feld = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const platz = useRef<HTMLDivElement>(null);
  const sig = useRef<{ striche: Strich[]; text: string; asp: number }>({ striche: [], text: "", asp: 1.8 });
  const masse = useRef({ w: 1, h: 1 });
  const malt = useRef(false);
  const strich = useRef<Strich | null>(null);
  const dick = useRef(2.6);
  const lt = useRef(0);
  const spiegel = useRef<number | null>(null);

  const zeichnen = useCallback(() => {
    const c = cv.current?.getContext("2d");
    if (!c) return;
    const { w, h } = masse.current;
    c.clearRect(0, 0, w, h);
    c.strokeStyle = "#1D4ED8"; c.fillStyle = "#1D4ED8"; c.lineCap = "round"; c.lineJoin = "round";
    const s = sig.current;
    if (s.text) {
      let fs = Math.round(h * 0.26);
      c.font = `500 ${fs}px "Dancing Script", cursive`;
      while (c.measureText(s.text).width > w - 52 && fs > 16) { fs -= 2; c.font = `500 ${fs}px "Dancing Script", cursive`; }
      c.fillText(s.text, 26, h - 44);
    }
    for (const st of s.striche) for (let j = 1; j < st.length; j++) {
      c.lineWidth = st[j][2]; c.beginPath(); c.moveTo(st[j - 1][0] * w, st[j - 1][1] * h); c.lineTo(st[j][0] * w, st[j][1] * h); c.stroke();
    }
    if (platz.current) platz.current.style.opacity = s.text || s.striche.length ? "0" : "1";
  }, []);
  const groesse = useCallback(() => {
    const q = feld.current?.getBoundingClientRect(), c = cv.current;
    if (!q || !c || q.width < 10 || q.height < 10) return;
    if (Math.round(q.width) === Math.round(masse.current.w) && Math.round(q.height) === Math.round(masse.current.h)) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    masse.current = { w: q.width, h: q.height };
    c.width = q.width * dpr; c.height = q.height * dpr;
    sig.current.asp = q.width / q.height;
    c.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
    zeichnen();
  }, [zeichnen]);
  const laenge = () => {
    const { w, h } = masse.current; let n = 0;
    for (const s of sig.current.striche) for (let j = 1; j < s.length; j++) n += Math.hypot((s[j][0] - s[j - 1][0]) * w, (s[j][1] - s[j - 1][1]) * h);
    return n;
  };
  const melden = () => {
    const s = sig.current;
    const da = !!s.text || laenge() > 60;
    onAenderung({
      da, getippt: !!s.text,
      png: () => { try { return cv.current?.toDataURL("image/png") ?? null; } catch { return null; } },
    });
  };
  const spiegeln = () => {
    if (spiegel.current) return;
    spiegel.current = window.setTimeout(() => { spiegel.current = null; buehne()?.signatur({ ...sig.current, striche: sig.current.striche.map((s) => s.slice()) }); }, 120);
  };

  useEffect(() => {
    groesse();
    if (typeof ResizeObserver === "undefined" || !feld.current) return;
    const ro = new ResizeObserver(() => groesse());
    ro.observe(feld.current);
    return () => ro.disconnect();
  }, [groesse]);

  const pos = (e: React.PointerEvent) => { const q = cv.current!.getBoundingClientRect(); return [e.clientX - q.left, e.clientY - q.top]; };
  const runter = (e: React.PointerEvent) => {
    if (sperren) return;
    e.preventDefault(); groesse();
    malt.current = true;
    if (sig.current.text) { sig.current.text = ""; zeichnen(); }
    const [x, y] = pos(e);
    strich.current = [[x / masse.current.w, y / masse.current.h, dick.current]];
    sig.current.striche.push(strich.current);
    lt.current = performance.now();
    try { cv.current?.setPointerCapture(e.pointerId); } catch { /* egal */ }
    if (platz.current) platz.current.style.opacity = "0";
  };
  const ziehen = (e: React.PointerEvent) => {
    if (!malt.current || !strich.current) return;
    const [x, y] = pos(e); const n = performance.now();
    const l = strich.current[strich.current.length - 1];
    const lx = l[0] * masse.current.w, ly = l[1] * masse.current.h;
    const d = Math.hypot(x - lx, y - ly);
    if (d < 0.6) return;
    const v = d / Math.max(1, n - lt.current);
    dick.current = dick.current * 0.7 + Math.max(1.4, 3.4 - v * 1.6) * 0.3;
    const c = cv.current!.getContext("2d")!;
    c.lineWidth = dick.current; c.beginPath(); c.moveTo(lx, ly); c.lineTo(x, y); c.stroke();
    strich.current.push([x / masse.current.w, y / masse.current.h, dick.current]);
    lt.current = n;
    spiegeln();
  };
  const hoch = () => { if (!malt.current) return; malt.current = false; melden(); spiegeln(); };

  return (
    <>
      <div className="an-unterschrift-feld" ref={feld} data-feld="unterschrift">
        <canvas ref={cv} onPointerDown={runter} onPointerMove={ziehen} onPointerUp={hoch} onPointerCancel={hoch} aria-label="Unterschriftsfeld" role="img" />
        <div className="an-grundlinie" /><div className="an-x">×</div>
        <div className="an-platz" ref={platz}>Hier unterschreiben</div>
      </div>
      <div className="an-chips">
        <button type="button" className="an-chip" disabled={sperren} onClick={() => { sig.current = { striche: [], text: "", asp: sig.current.asp }; zeichnen(); melden(); buehne()?.signatur(sig.current); }}>Neu zeichnen</button>
        <button type="button" className="an-chip" disabled={sperren} onClick={() => {
          sig.current = { striche: [], text: getippterName, asp: sig.current.asp };
          ereignis("unterschrift_getippt", { schritt: "unterschrift" });
          zeichnen(); melden(); buehne()?.signatur(sig.current);
          void document.fonts?.load?.('500 40px "Dancing Script"').then(() => { zeichnen(); melden(); buehne()?.signatur(sig.current); });
        }}>Lieber den Namen tippen</button>
      </div>
    </>
  );
}

export function SchrittUnterschrift() {
  const { S, setze, gehe, buehne, lichtStreif, oeffneSheet, sitzung, toast, ereignis } = useAntrag();
  const P = paket(S.paket);
  const r = rate(S.paket);
  const [sig, setSig] = useState<{ da: boolean; getippt: boolean; png: () => string | null }>({ da: false, getippt: false, png: () => null });
  const [fehlt, setFehlt] = useState<"" | "ag1" | "ag3" | "sig">("");
  const [annahme, setAnnahme] = useState<"" | "laeuft" | "fertig">("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [tippText, setTippText] = useState("Ihr Vertrag wird geschlossen …");
  const faelligBis = new Date(Date.now() + 7 * 864e5);
  const agb = agbDatum(AGB_FASSUNG);
  const maske = (() => { const m = S.email || ""; return `${m.charAt(0)}•••@${m.split("@")[1] || ""}`; })();

  const annehmen = async () => {
    if (annahme) return;
    if (!sig.da) { setFehlt("sig"); document.querySelector('[data-feld="unterschrift"]')?.scrollIntoView({ behavior: "smooth", block: "center" }); toast("Bitte unterschreiben Sie auf der Linie."); ereignis("fehler", { schritt: "unterschrift", detail: "unterschrift" }); return; }
    if (!S.ag1) { setFehlt("ag1"); document.getElementById("an-ag1")?.scrollIntoView({ behavior: "smooth", block: "center" }); toast("Bitte bestätigen Sie die AGB."); ereignis("fehler", { schritt: "unterschrift", detail: "ag1" }); return; }
    if (!S.ag3) { setFehlt("ag3"); document.getElementById("an-ag3")?.scrollIntoView({ behavior: "smooth", block: "center" }); toast("Bitte bestätigen Sie, dass Sie die Bestellung geprüft haben."); ereignis("fehler", { schritt: "unterschrift", detail: "ag3" }); return; }
    const luecke = antragNeuLuecke(datenAus(S));
    if (luecke) { gehe(luecke, { richtung: "zurueck" }); toast("Bitte ergänzen Sie noch Ihre Angaben."); return; }
    const png = sig.png();
    if (!png) { setFehlt("sig"); toast("Bitte unterschreiben Sie noch einmal auf der Linie."); return; }
    setFehler(null);
    setAnnahme("laeuft");
    const antwort = await api.annehmen(S.ref!, {
      daten: datenAus(S), sitzung, knopf: KNOPF_ZAHLUNGSPFLICHTIG,
      haken: { agb: S.ag1, geprueft: S.ag3, sofort: S.ag4 },
      unterschrift: { png, getippt: sig.getippt }, messung: messungsDaten(),
    });
    const j: any = antwort.json;
    if (!antwort.ok || !j?.angenommenAm) {
      setAnnahme("");
      if (j?.zurueck?.schritt) { toast(j.zurueck.meldung); gehe(j.zurueck.schritt, { richtung: "zurueck", hinweis: { text: j.zurueck.meldung } }); return; }
      if (j?.feld === "unterschrift") setFehlt("sig");
      setFehler(j?.error || "Keine Verbindung. Ihr Vertrag ist noch nicht geschlossen – bitte versuchen Sie es noch einmal.");
      return;
    }
    const am = new Date(j.angenommenAm);
    setze({
      angenommenAm: j.angenommenAm, sofortBeginn: !!j.sofortBeginn, paymentReference: j.paymentReference ?? null,
      betrag: j.betrag ?? null, faellig: j.faellig ?? null, verknuepft: !!j.linkedToExisting, bezahlt: !!j.alreadyPaid, rueckZu: "",
    });
    metaEreignis(META_EREIGNIS.antragFertig, S.ref!, { content_name: P.name, value: r });
    const b = buehne();
    b?.stempel(`Angenommen · ${datum(am)} · ${uhr(am)}`);
    lichtStreif(); b?.warmLicht();
    setAnnahme("fertig");
    window.setTimeout(() => setTippText(`Ihre Vertragsbestätigung ist unterwegs an ${maske}.`), 1100);
    window.setTimeout(() => gehe("zahlung"), 2900);
  };

  return (
    <>
      <Titel text="Ihre Unterschrift." />
      <Lead>Mit dem Finger auf die Linie schreiben – am Computer mit Maus oder Trackpad.</Lead>
      <Unterschriftsfeld getippterName={kartenName(S)} sperren={!!annahme}
        onAenderung={(o) => { setSig(o); if (o.da && fehlt === "sig") setFehlt(""); }} />
      {fehlt === "sig" ? <Tipp text="Bitte unterschreiben Sie auf der Linie – etwas größer, wenn es nicht reicht." /> : null}
      <div className="an-uebersicht">
        <h3>Ihre Bestellung</h3>
        <Zeile a="Anbieter" b={`${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}`} />
        <Zeile a="Paket" b={P.name} />
        <div className="an-zeile"><span>Leistung</span><span style={{ textAlign: "left", maxWidth: "68%" }}>{P.zeile}</span></div>
        <Zeile a="Ziel-Limit" b={`${euro(S.limit, false)} (Ihre Angabe)`} />
        <div className="an-zeile"><span>Monatsrate</span><span>{euro(r)} · zinsfrei<small style={{ display: "block", color: "var(--tinte-2)", fontSize: ".8125rem" }}>12 Raten · zusammen {euro(r * 12)}</small></span></div>
        <Zeile a="Laufzeit" b="12 Monate, danach monatlich kündbar" />
        <Zeile a="Erste Rate" b={`mit Vertragsschluss, bitte bis ${datum(faelligBis)}`} />
        <Zeile a="Zahlung" b="per Überweisung" />
        <p className="an-bank">Kündigung: {KUENDIGUNG_ZEILE}</p>
        <p className="an-bank">{BANK_SATZ}</p>
        <p className="an-bank">{FUSS_SATZ}</p>
        <p className="an-bank">
          <a href="/agb" target="_blank" rel="noopener">AGB</a> · <button type="button" className="an-knopf an-text an-link" style={{ fontSize: "inherit", minHeight: 0 }} onClick={() => oeffneSheet(<VertragSheet fokus="widerruf" />)}>Widerrufsbelehrung</button> · <a href="/datenschutz" target="_blank" rel="noopener">Datenschutz</a>
        </p>
      </div>
      <Haken id="an-ag1" an={S.ag1} fehlt={fehlt === "ag1"} onClick={() => { setze({ ag1: !S.ag1 }); if (fehlt === "ag1") setFehlt(""); }}>
        Ich akzeptiere die <a href="/agb" target="_blank" rel="noopener">AGB (Fassung vom {agb})</a>.
      </Haken>
      <Haken id="an-ag3" an={S.ag3} fehlt={fehlt === "ag3"} onClick={() => { setze({ ag3: !S.ag3 }); if (fehlt === "ag3") setFehlt(""); }}>{ANTRAG_NEU_HAKEN_GEPRUEFT}</Haken>
      <Haken id="an-ag4" an={S.ag4} onClick={() => setze({ ag4: !S.ag4 })}>{ANTRAG_NEU_SOFORT_TEXT}</Haken>
      <p className="an-klein" style={{ margin: "-4px 0 0 36px" }}>{ANTRAG_NEU_SOFORT_OHNE}</p>
      <p className="an-klein" style={{ margin: 0 }}>{ANTRAG_NEU_WERBE_HINWEIS}</p>
      {fehler ? <Fehlerkasten text={fehler} /> : null}
      <div className="an-knoepfe">
        {annahme === "fertig" || annahme === "laeuft" ? (
          <>
            <div className="an-fortschrittslinie"><i /></div>
            {annahme === "fertig" ? <Tippbar text={tippText} klasse="an-fuss-zeile" ms={14} /> : <div className="an-fuss-zeile">Ihr Vertrag wird geschlossen …</div>}
          </>
        ) : (
          <>
            <button type="button" className="an-knopf an-haupt" onClick={() => void annehmen()}>{KNOPF_ZAHLUNGSPFLICHTIG}</button>
            <div className="an-fuss-zeile">{euro(r)} im Monat für 12 Monate (zusammen {euro(r * 12)}). Erste Rate mit Vertragsschluss fällig, bitte bis {datum(faelligBis)}. Bestätigung, Vertrag und Widerrufsbelehrung kommen sofort per E-Mail.</div>
          </>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Zahlung — „Aktivieren Sie Ihren Account."
// ═══════════════════════════════════════════════════════════════════════════
function Posten({ n, label, anzeige, kopie, mono, unter }: { n: number; label: string; anzeige: string; kopie: string; mono?: boolean; unter?: string }) {
  const { toast, ereignis } = useAntrag();
  const [ok, setOk] = useState(false);
  const wert = useRef<HTMLSpanElement>(null);
  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(kopie);
      setOk(true); ereignis("kopiert", { schritt: "zahlung", detail: label.toLowerCase().replace(/[^a-z]/g, "") });
      setTimeout(() => setOk(false), 1800);
    } catch {
      const s = wert.current; if (!s) return;
      const r = document.createRange(); r.selectNodeContents(s);
      const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
      toast("Markiert – gedrückt halten und „Kopieren“ wählen.");
    }
  };
  return (
    <div className="an-posten">
      <span className="an-nr">{n}</span>
      <div className="an-wert"><small>{label}</small><span className={mono ? "an-mono" : ""} ref={wert}>{anzeige}</span>{unter ? <em>{unter}</em> : null}</div>
      <button type="button" className={`an-kopieren${ok ? " an-ok" : ""}`} onClick={() => void kopieren()} style={{ minHeight: 32 }}>{ok ? "Kopiert" : "Kopieren"}</button>
    </div>
  );
}

export function SchrittZahlung() {
  const { S, setze, gehe, oeffneSheet, ereignis, toast } = useAntrag();
  const P = paket(S.paket);
  const [daten, setDaten] = useState<{ betrag: number; faellig: string | null; referenz: string } | null>(
    S.paymentReference ? { betrag: Number(S.betrag) || rate(S.paket), faellig: S.faellig, referenz: S.paymentReference } : null);
  const [geraet, setGeraet] = useState<"handy" | "pc">(() => { try { return window.matchMedia("(pointer: coarse)").matches ? "handy" : "pc"; } catch { return "handy"; } });
  const [meldet, setMeldet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!S.paymentReference) return;
    void api.zahlungsauftrag(S.paymentReference).then((r) => {
      const j: any = r.json;
      if (r.ok && j) {
        setDaten({ betrag: Number(j.amountDue) || rate(S.paket), faellig: j.dueDate ?? S.faellig, referenz: j.paymentReference || S.paymentReference! });
        if (j.status === "paid") setze({ bezahlt: true });
      }
    });
  }, [S.paymentReference]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!S.paymentReference || !daten) {
    return (
      <>
        <Titel text="Aktivieren Sie Ihren Account." />
        {S.verknuepft
          ? <div className="an-hinweis">Ihr Vertrag ist angenommen und mit Ihrem bestehenden FIAON-Konto verbunden. Die Zahlungsdaten finden Sie in Ihrem Kundenbereich und in Ihrer E-Mail.</div>
          : <Fehlerkasten text="Ihre Zahlungsdaten werden gerade erstellt. Sie kommen auch per E-Mail. Bitte laden Sie die Seite gleich neu." knopf="Neu laden" onKnopf={() => window.location.reload()} />}
        <div className="an-knoepfe"><a className="an-knopf an-leise" href="/app/login">Zum Kundenbereich</a></div>
      </>
    );
  }
  const betragText = daten.betrag.toFixed(2).replace(".", ",");
  const faellig = daten.faellig ? new Date(daten.faellig) : new Date(Date.now() + 7 * 864e5);
  const qr = buildEpcQrPayload({ bic: BANK.bic, recipient: BANK.empfaenger, iban: BANK.iban, amount: daten.betrag, remittance: daten.referenz } as any);
  const melden = async () => {
    setMeldet(true); setFehler(null);
    const r = await api.zahlungGemeldet(daten.referenz);
    setMeldet(false);
    if (!r.ok && r.status !== 404) { setFehler("Ihre Meldung kam gerade nicht an. Bitte versuchen Sie es noch einmal."); return; }
    ereignis("zahlung_gemeldet", { schritt: "zahlung" });
    setze({ zahlungGemeldet: true, zahlungGemeldetAm: new Date().toISOString() });
    gehe("danke");
  };
  return (
    <>
      <Titel text="Aktivieren Sie Ihren Account." />
      <Lead>{S.sofortBeginn !== false
        ? "Ihr Konto ist sofort nach Zahlungseingang aktiv."
        : "Ihr Konto ist sofort nach Zahlungseingang aktiv. Mit den Leistungen beginnen wir nach Ablauf der Widerrufsfrist – so haben Sie es gewählt."}</Lead>
      {S.verknuepft ? <div className="an-hinweis">Ihr Vertrag ist mit Ihrem bestehenden FIAON-Konto verbunden.</div> : null}
      <div className="an-traeger">
        <Posten n={1} label="Empfänger" anzeige={BANK.empfaenger} kopie={BANK.empfaenger} />
        <Posten n={2} label="IBAN" anzeige={BANK.ibanDisplay} kopie={BANK.iban} mono />
        <Posten n={3} label="Betrag" anzeige={`${euro(daten.betrag)} · erste Monatsrate`} kopie={betragText} />
        <Posten n={4} label="Verwendungszweck" anzeige={daten.referenz} kopie={daten.referenz} mono unter="Bitte genau so angeben, dann ordnen wir Ihre Zahlung sofort zu." />
      </div>
      <div className="an-klein">BIC {BANK.bic} · {BANK.bank} · bitte bis {datum(faellig)}</div>
      <Seg name="geraet" label="Wo überweisen Sie?" werte={[["handy", "Am Handy"], ["pc", "Am Computer"]]} wahl={geraet} onWahl={setGeraet} />
      {geraet === "handy" ? (
        <>
          <ol className="an-schritte"><li>Banking-App öffnen</li><li>Neue Überweisung wählen</li><li>Die vier Angaben oben einzeln kopieren und einfügen</li></ol>
          <button type="button" className="an-knopf an-leise" style={{ marginTop: 8, width: "100%" }} onClick={() => oeffneSheet(<QrSheet daten={qr} />)}>QR-Code zum Speichern zeigen</button>
        </>
      ) : (
        <>
          <div className="an-qr"><QRCodeSVG value={qr} size={180} level="M" includeMargin /></div>
          <div className="an-klein" style={{ textAlign: "center", marginTop: 6 }}>Mit der Banking-App scannen – alle Angaben sind dann schon ausgefüllt.</div>
        </>
      )}
      {fehler ? <Fehlerkasten text={fehler} /> : null}
      <div className="an-knoepfe">
        <button type="button" className="an-knopf an-haupt" onClick={() => void melden()} disabled={meldet}>{meldet ? <span className="an-laden" aria-hidden="true" /> : null}Ich habe überwiesen</button>
        {S.rueckruf
          ? <div className="an-rueckruf-zeile"><span>Ihr Rückruf: {S.rueckruf.text}{mitWem(S.rueckruf.mit)}</span></div>
          : <button type="button" className="an-knopf an-text" style={{ alignSelf: "center" }} onClick={() => oeffneSheet(<TerminWahl art="vorher" />)}>Fragen vor der Überweisung? Wir rufen Sie an.</button>}
      </div>
      <div className="an-chips" style={{ justifyContent: "center" }}>
        <a className="an-chip" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", color: "inherit" }} href={api.vertragPdf(S.ref!)} target="_blank" rel="noopener" onClick={() => ereignis("vertrag_pdf", { schritt: "zahlung" })}>Vertrag (PDF)</a>
        <a className="an-chip" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", color: "inherit" }} href={api.rechnung(S.ref!)} target="_blank" rel="noopener" onClick={() => ereignis("rechnung_pdf", { schritt: "zahlung" })}>Rechnung (PDF)</a>
      </div>
      {S.bezahlt ? <button type="button" className="an-knopf an-text" style={{ alignSelf: "center" }} onClick={() => { toast("Ihre Zahlung ist schon da."); gehe("danke"); }}>Zahlung ist schon da – weiter</button> : null}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Danke — Gespräch, Auskunft, Bereich
// ═══════════════════════════════════════════════════════════════════════════
export function SchrittDanke() {
  const { S, setze, oeffneSheet, ereignis, toast, gehe } = useAntrag();
  const P = paket(S.paket);
  const g = S.bezahlt;
  const [oeffnet, setOeffnet] = useState(false);
  useEffect(() => {
    if (!S.ref) return;
    void api.stand(S.ref).then((r) => { const j: any = r.json; if (r.ok && j?.zahlungsstatus === "paid") setze({ bezahlt: true }); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bereich = async () => {
    setOeffnet(true);
    const r = await api.einloggen(S.ref!);
    if (!r.ok) {
      setOeffnet(false);
      toast((r.json as any)?.error || "Bitte melden Sie sich mit Ihrer E-Mail-Adresse an.");
      window.location.href = `/app/login?email=${encodeURIComponent(S.email)}`;
      return;
    }
    ereignis("konto_betreten", { schritt: "danke" });
    // Ab jetzt trägt die Anmeldung im Kundenbereich. Der Antrag wird auf diesem Gerät
    // vergessen — wer /antrag-neu danach öffnet (geteiltes Gerät), sieht nicht diesen Vertrag.
    await api.vergessen();
    zustandVergessen();
    window.location.href = "/app";
  };
  const mitStart = S.paket !== "start";
  const gemeldetAm = S.zahlungGemeldetAm ? new Date(S.zahlungGemeldetAm) : null;
  const fristAb = widerrufsfristAb(S);
  return (
    <>
      <Titel text={g ? `Ihr Konto ist aktiv${anredeKurz(S)}.` : `Danke${anredeKurz(S)}. Wir gleichen Ihre Zahlung ab.`} />
      {g
        ? <div className="an-bezahlt-zeile">Zahlung eingegangen</div>
        : <Lead>Ihre Überweisung ist in der Regel am nächsten Werktag bei uns. Dann schalten wir Ihr Konto frei, und Sie bekommen eine E-Mail.</Lead>}
      {mitStart ? (g ? <StartBox /> : <VorabBox />) : null}
      <AuskunftBox />
      <div className="an-feld">
        <span className="an-etikett">So geht es weiter</span>
        <ol className="an-weg">
          <li data-n="1" className={S.zahlungGemeldet || g ? "an-erledigt" : ""}><span><b>Zahlung gemeldet</b>{gemeldetAm ? `${zeitText(gemeldetAm)} Uhr` : g ? "nicht nötig – Ihre Zahlung ist da" : "noch offen"}</span></li>
          <li data-n="2" className={g ? "an-erledigt" : ""}><span><b>Zahlung eingegangen</b>Ihr Konto ist aktiv</span></li>
          <li data-n="3"><span><b>Link unserer Partnerbank</b>{fristAb ? `Weil Sie keinen sofortigen Beginn verlangt haben, kommt der Link nach Ablauf der Widerrufsfrist – ab dem ${datum(fristAb)}.` : KARTE_LINK_SATZ}</span></li>
          {mitStart ? <li data-n="4" className={S.termin ? "an-erledigt" : ""}><span><b>Startgespräch</b>{S.termin ? `${S.termin.text}${mitWem(S.termin.mit)}` : !g ? "Nach Zahlungseingang wählen Sie Ihren Termin in Ihrem Bereich" : fristAb ? `ab dem ${datum(fristAb)}, nach Ablauf der Widerrufsfrist` : "mit Ihrer festen Ansprechpartnerin"}</span></li> : null}
          <li data-n={mitStart ? "5" : "4"}><span><b>Ihre Karte</b>Nach der Zusage der Bank in der Regel in 2–5 Werktagen bei Ihnen – online in der Regel sofort nach der Freigabe, auch mit Apple Pay und Google Pay.</span></li>
        </ol>
      </div>
      <div className="an-box">
        <span className="an-marke">Ihr Bereich</span>
        <h2>Ihr Bereich ist schon eingerichtet.</h2>
        <p>Öffnen Sie ihn gleich hier. Später melden Sie sich mit Ihrer E-Mail-Adresse an – Sie bekommen einen Anmelde-Link, ein Passwort brauchen Sie dafür nicht. Ihre persönliche PIN ändern Sie dort jederzeit.</p>
        <button type="button" className="an-knopf an-haupt" onClick={() => void bereich()} disabled={oeffnet}>{oeffnet ? <span className="an-laden" aria-hidden="true" /> : null}Bereich öffnen<Pfeil /></button>
        {S.passwort ? <div className="an-erledigt-zeile">Passwort festgelegt</div>
          : <button type="button" className="an-knopf an-text" style={{ alignSelf: "flex-start" }} onClick={() => oeffneSheet(<PasswortSheet />)}>Passwort festlegen (freiwillig)</button>}
      </div>
      {!S.zahlungGemeldet && !g ? <button type="button" className="an-knopf an-text" style={{ alignSelf: "center" }} onClick={() => gehe("zahlung", { richtung: "zurueck" })}>Zurück zu den Zahlungsdaten</button> : null}
      <p className="an-klein" style={{ textAlign: "center", margin: 0 }}>Vorgang {S.ref} · {P.name}</p>
    </>
  );
}

/** „heute, 14:05" bzw. „06.10.2026, 14:05". */
function zeitText(d: Date): string {
  const heute = datum(new Date()) === datum(d);
  return `${heute ? "heute" : datum(d)}, ${uhr(d)}`;
}

/**
 * Kein sofortiger Beginn verlangt (Vertrag § 6): Bis wann laufen die Leistungen noch nicht?
 * Dieselbe Frist wie Akten-Vermerk und Kartenlink-Automatik (15 Tage ab Annahme). Danach null.
 */
function widerrufsfristAb(S: Zustand): Date | null {
  if (S.sofortBeginn !== false || !S.angenommenAm) return null;
  const ab = new Date(new Date(S.angenommenAm).getTime() + 15 * 864e5);
  return ab.getTime() > Date.now() ? ab : null;
}

/** Vor Zahlungseingang: kein Startgespräch (das bucht der Kunde nach der Zahlung), aber Fragen gehen immer. */
function VorabBox() {
  const { S } = useAntrag();
  const P = paket(S.paket);
  return (
    <div className="an-box">
      <span className="an-marke">In {P.name} enthalten: Ihr Startgespräch</span>
      <h2>Ihr Startgespräch wählen Sie nach Zahlungseingang.</h2>
      <p>Sobald Ihre erste Rate da ist, wählen Sie Ihren Termin in Ihrem Bereich – Ihre feste Ansprechpartnerin geht dann Ihre Lage mit Ihnen durch. Fragen schon vorher? Wählen Sie eine Zeit, wir rufen Sie an.</p>
      <TerminWahl art="vorher" eingebettet />
    </div>
  );
}

function StartBox() {
  const { S } = useAntrag();
  const P = paket(S.paket);
  const t = S.termin;
  const fristAb = widerrufsfristAb(S);
  if (!t && fristAb) {
    return (
      <div className="an-box">
        <span className="an-marke">In {P.name} enthalten</span>
        <h2>Ihr Startgespräch folgt nach der Widerrufsfrist.</h2>
        <p>Sie haben keinen sofortigen Beginn verlangt. Deshalb beginnen wir mit den Leistungen ab dem {datum(fristAb)} – den Termin für Ihr Startgespräch wählen Sie dann in Ihrem Bereich.</p>
      </div>
    );
  }
  if (t) {
    return (
      <div className="an-box">
        <span className="an-marke">Startgespräch</span>
        <div className="an-erledigt-zeile">{t.text}{mitWem(t.mit)}</div>
        <p>Wir rufen Sie unter {telefonText(S)} an und gehen Ihre Lage mit Ihnen durch. Die Bestätigung mit Kalendereintrag kommt per E-Mail.</p>
      </div>
    );
  }
  return (
    <div className="an-box">
      <span className="an-marke">In {P.name} enthalten</span>
      <h2>Wann passt Ihr Startgespräch?</h2>
      <p>Ihre Ansprechpartnerin ruft Sie an, geht Ihre Lage mit Ihnen durch und legt Ihren Fahrplan fest. Etwa 20 Minuten.</p>
      <TerminWahl art="start" eingebettet />
    </div>
  );
}

function AuskunftBox() {
  const { S, setze, oeffneSheet, ereignis } = useAntrag();
  const [wahl, setWahl] = useState<"" | "besorgen" | "selbst" | "habe">("");
  const wort = S.land === "DE" ? "SCHUFA-Auskunft" : S.land === "AT" ? "KSV-Auskunft" : "Bonitätsauskunft";
  if (S.auskunft === "bestellt") {
    return (
      <div className="an-box">
        <span className="an-marke">Bonitätsauskunft</span>
        <div className="an-erledigt-zeile">Bestellt zum Kundenpreis von 74 €</div>
        <p>{S.bezahlt ? "Ihre erste Rate ist da – Rechnung und Zahlungsdaten der Auskunft kommen per E-Mail." : "Rechnung und Zahlungsdaten kommen erst nach Ihrer ersten Paketzahlung per E-Mail. Ihre Überweisung von heute bleibt, wie sie ist."}</p>
      </div>
    );
  }
  if (S.auskunft === "selbst") {
    return (
      <div className="an-box">
        <span className="an-marke">Bonitätsauskunft</span>
        <div className="an-erledigt-zeile">Sie fordern Ihre {wort} selbst an</div>
        <p>So geht es kostenlos, Schritt für Schritt: <a href="/bonitaetsauskunft-beantragen" target="_blank" rel="noopener" style={{ color: "var(--tief)" }}>Anleitung öffnen</a>. Sobald die Antwort da ist, laden Sie sie in Ihrem Bereich hoch.</p>
        <button type="button" className="an-knopf an-text" style={{ alignSelf: "flex-start" }} onClick={() => setze({ auskunft: "" })}>Doch lieber besorgen lassen</button>
      </div>
    );
  }
  if (S.auskunft === "habe") {
    return (
      <div className="an-box">
        <span className="an-marke">Bonitätsauskunft</span>
        <div className="an-erledigt-zeile">Sie haben Ihre Auskunft schon</div>
        <p>Laden Sie sie in Ihrem Bereich hoch, ein Foto mit dem Handy genügt.</p>
        <button type="button" className="an-knopf an-text" style={{ alignSelf: "flex-start" }} onClick={() => setze({ auskunft: "" })}>Ändern</button>
      </div>
    );
  }
  const empfohlen = S.eintraege === "ja" || S.eintraege === "weiss_nicht";
  const w = (k: "besorgen" | "selbst" | "habe", t: string, u: string) => (
    <button type="button" className="an-zeile-w" style={{ gridTemplateColumns: "18px 1fr", alignItems: "start" }} role="radio" aria-checked={wahl === k} onClick={() => { setWahl(k); ereignis("auskunft_wahl", { schritt: "danke", detail: k }); }}>
      <span className="an-rund" style={{ marginTop: 2 }} /><span><b style={{ fontWeight: 500 }}>{t}</b><small>{u}</small></span>
    </button>
  );
  return (
    <div className="an-box">
      <span className={`an-marke${empfohlen ? " an-warm" : ""}`}>{empfohlen ? "Für Ihre Lage wichtig" : "Damit wir starten können"}</span>
      <h2>Ihre {wort}.</h2>
      <p>Mit Ihrer Auskunft sehen wir, was die Bank sieht – und richten Ihren Weg zur Karte genau danach aus.</p>
      <div className="an-liste" role="radiogroup" aria-label="Ihre Auskunft">
        {w("besorgen", "Wir besorgen sie für Sie", "74 € als FIAON-Kunde · einzeln 149 € · einmalig, kein Abo. Fällig erst nach Ihrer ersten Paketzahlung.")}
        {w("selbst", "Ich fordere sie selbst kostenlos an", "Die Datenkopie steht Ihnen kostenlos zu. Die Antwort kommt per Post, spätestens nach einem Monat.")}
        {w("habe", "Habe ich schon", "Laden Sie sie im Bereich hoch, ein Foto genügt.")}
      </div>
      {wahl ? (
        <button type="button" className="an-knopf an-leise" onClick={() => { if (wahl === "besorgen") oeffneSheet(<AuskunftSheet />); else setze({ auskunft: wahl }); }}>
          {wahl === "besorgen" ? "Ansehen und bestellen" : "Übernehmen"}
        </button>
      ) : null}
    </div>
  );
}

export type { Zustand };
