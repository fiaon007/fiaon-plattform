// ═══════════════════════════════════════════════════════════════════════════
// /business/angebot/:token/bestehende-gesellschaft — BISHERIGE US-GESELLSCHAFT: LÖSCHEN ODER ÜBERTRAGEN (17.11.2026)
//
// Justin: „baue ihm die Seite für die alte LLC — er fragte, ob er diese auch jemand anderem übertragen kann statt löschen.
// Uns ist beides recht, er soll uns nur mitteilen wie, wo genau.“
// Eine ruhige Glas-Seite in drei Schritten: Welche Gesellschaft? → Löschen oder übertragen (und an wen)? → Bestätigen.
// Prüfung und Wortlaut: shared/fiaon-global-bestehende-llc.ts; Server: server/lib/fiaon-global-bestehende-llc.ts.
// Die Seite misst nichts und setzt nichts; sie ist für Suchmaschinen gesperrt (noindex).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { Dunkel } from "@/components/site/DunkleBuehne";
import { bestehendeLlcPruefen, BESTEHENDE_LLC_STAATEN, type BestehendeLlcWahl } from "@shared/fiaon-global-bestehende-llc";
import "@/styles/global-apple.css";
import "@/styles/global-bestehende-llc.css";

interface Sicht {
  ok: boolean; vorschau: boolean; anrede: string; nachname: string; auftraggeber: string; loeschungUsd: number;
  weisung: { am: string; kurz: string; wahl: BestehendeLlcWahl } | null;
}
type Feld = string | null;

const amText = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d) + " Uhr";
};

function Haken() {
  return <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 10.4l3.1 3.1L15 6.6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function BusinessBestehendeLlc() {
  const [, treffer] = useRoute("/business/angebot/:token/bestehende-gesellschaft");
  const token = treffer?.token ? decodeURIComponent(treffer.token) : "";
  const api = `/api/fiaon/global/angebot/${encodeURIComponent(token)}/bestehende-gesellschaft`;

  const [sicht, setSicht] = useState<Sicht | null>(null);
  const [ladeFehler, setLadeFehler] = useState("");
  const [fertig, setFertig] = useState<{ kurz: string; am: string } | null>(null);
  const [neu, setNeu] = useState(false);

  // Eingaben
  const [name, setName] = useState("");
  const [staat, setStaat] = useState<string>("Florida");
  const [nr, setNr] = useState("");
  const [wahl, setWahl] = useState<BestehendeLlcWahl | null>(null);
  const [art, setArt] = useState<"person" | "firma">("person");
  const [eName, setEName] = useState("");
  const [vertreten, setVertreten] = useState("");
  const [strasse, setStrasse] = useState("");
  const [plz, setPlz] = useState("");
  const [ort, setOrt] = useState("");
  const [land, setLand] = useState("Deutschland");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [anteil, setAnteil] = useState("100");
  const [stichtag, setStichtag] = useState("");
  const [anmerkung, setAnmerkung] = useState("");
  const [bestaetigt, setBestaetigt] = useState("");
  const [weisungOk, setWeisungOk] = useState(false);
  const [fehler, setFehler] = useState<{ feld: Feld; text: string } | null>(null);
  const [sendet, setSendet] = useState(false);

  // Für Suchmaschinen gesperrt, eigener Titel.
  useEffect(() => {
    const titelVorher = document.title;
    document.title = "Ihre bisherige Gesellschaft · FIAON Global";
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const vorher = robots?.content ?? null;
    const neuMeta = !robots;
    if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.appendChild(robots); }
    robots.content = "noindex, nofollow";
    return () => { if (neuMeta) robots!.remove(); else robots!.content = vorher ?? ""; document.title = titelVorher; };
  }, []);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const r = await fetch(api, { credentials: "include" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) { setLadeFehler(String(j.error || "Die Seite lässt sich gerade nicht laden.")); return; }
        setSicht(j as Sicht);
      } catch { setLadeFehler("Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung und laden Sie die Seite neu."); }
    })();
  }, [api, token]);

  const eingabe = useMemo(() => ({
    wahl, gesellschaft: { name, staat, dokumentNr: nr },
    empfaenger: wahl === "uebertragen" ? { art, name: eName, vertreten, strasse, plz, ort, land, email, telefon } : null,
    anteil: wahl === "uebertragen" ? Number(anteil) : null, stichtag, anmerkung, bestaetigtMit: bestaetigt, weisungBestaetigt: weisungOk,
  }), [wahl, name, staat, nr, art, eName, vertreten, strasse, plz, ort, land, email, telefon, anteil, stichtag, anmerkung, bestaetigt, weisungOk]);

  const senden = async () => {
    if (!sicht) return;
    const p = bestehendeLlcPruefen(eingabe, sicht.auftraggeber);
    if (!p.ok) {
      setFehler({ feld: p.feld, text: p.fehler });
      document.querySelector(`[data-feld="${p.feld}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setFehler(null); setSendet(true);
    try {
      const r = await fetch(api, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eingabe) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setFehler({ feld: j.feld ?? null, text: String(j.error || "Das hat nicht geklappt. Bitte versuchen Sie es noch einmal.") }); return; }
      setFertig({ kurz: String(j.weisung?.kurz ?? ""), am: String(j.weisung?.am ?? new Date().toISOString()) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setFehler({ feld: null, text: "Keine Verbindung. Es wurde nichts gespeichert — bitte versuchen Sie es noch einmal." }); }
    finally { setSendet(false); }
  };

  const fehlerBei = (f: string) => (fehler?.feld === f ? <p className="gbl-fehler" role="alert">{fehler.text}</p> : null);
  const gruss = sicht ? (sicht.anrede === "Frau" ? `Guten Tag, Frau ${sicht.nachname}.` : sicht.anrede === "Herr" ? `Guten Tag, Herr ${sicht.nachname}.` : `Guten Tag, ${sicht.auftraggeber}.`) : "";
  const zeigeFormular = sicht && !fertig && (!sicht.weisung || neu);

  return (
    <Dunkel seite="business" titel="Ihre bisherige Gesellschaft · FIAON Global" beschreibung="">
      <main className="gbl">
        <div className="gbl-licht" aria-hidden="true" />
        <section className="gbl-kopf">
          <p className="gbl-auge">Ihre bisherige Gesellschaft</p>
          <h1>Löschen oder übertragen?<em>Sie entscheiden — wir erledigen den Rest.</em></h1>
          {sicht && <p className="gbl-lead">{gruss} Ihre bisherige US-Gesellschaft können Sie löschen lassen oder an eine andere Person oder Firma übertragen. Beides übernehmen wir für Sie — sagen Sie uns hier einfach, was Sie möchten.</p>}
          {sicht?.vorschau && <p className="gbl-vorschau">Vorschau der Leitung — absenden kann nur der Kunde.</p>}
        </section>

        {!sicht && !ladeFehler && <p className="gbl-laedt">Einen Moment …</p>}
        {ladeFehler && <div className="gbl-karte gbl-hinweis" role="alert">{ladeFehler}</div>}

        {fertig && sicht && (
          <section className="gbl-karte gbl-fertig" aria-live="polite">
            <span className="gbl-fertig-zeichen"><Haken /></span>
            <h2>Danke — Ihre Weisung ist angekommen.</h2>
            <p className="gbl-fertig-was">{fertig.kurz}</p>
            <p>Eine Kopie haben wir Ihnen per E-Mail geschickt; sie liegt außerdem in Ihrem persönlichen Bereich. Wir bereiten jetzt alles vor und melden uns, sobald es etwas zu unterschreiben gibt.</p>
            <p className="gbl-klein">Möchten Sie etwas ändern? Antworten Sie einfach auf die E-Mail — oder <button type="button" className="gbl-textknopf" onClick={() => { setFertig(null); setNeu(true); }}>erteilen Sie hier eine neue Weisung</button>.</p>
          </section>
        )}

        {sicht?.weisung && !neu && !fertig && (
          <section className="gbl-karte gbl-fertig">
            <span className="gbl-fertig-zeichen"><Haken /></span>
            <h2>Ihre Weisung liegt uns vor.</h2>
            <p className="gbl-fertig-was">{sicht.weisung.kurz}</p>
            <p className="gbl-klein">Erteilt am {amText(sicht.weisung.am)}. Möchten Sie etwas ändern? <button type="button" className="gbl-textknopf" onClick={() => setNeu(true)}>Neue Weisung erteilen</button></p>
          </section>
        )}

        {zeigeFormular && (
          <>
            {/* 1 — Welche Gesellschaft? */}
            <section className="gbl-karte" aria-labelledby="gbl-s1">
              <p className="gbl-schritt"><span>1</span>Ihre Gesellschaft</p>
              <h2 id="gbl-s1">Um welche Gesellschaft geht es?</h2>
              <div className="gbl-raster">
                <label className="gbl-feld breit" data-feld="gesellschaft.name">Name der Gesellschaft
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Muster Consulting LLC" autoComplete="off" />
                  {fehlerBei("gesellschaft.name")}
                </label>
                <label className="gbl-feld">Bundesstaat
                  <select value={staat} onChange={(e) => setStaat(e.target.value)}>
                    {BESTEHENDE_LLC_STAATEN.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="gbl-feld" data-feld="gesellschaft.dokumentNr">Registernummer <small>falls zur Hand</small>
                  <input value={nr} onChange={(e) => setNr(e.target.value)} placeholder="z. B. L21000123456" autoComplete="off" />
                  {fehlerBei("gesellschaft.dokumentNr")}
                </label>
              </div>
              <p className="gbl-klein">Die Registernummer steht im Handelsregister des Bundesstaats (in Florida auf sunbiz.org). Fehlt sie Ihnen, suchen wir sie heraus.</p>
            </section>

            {/* 2 — Löschen oder übertragen? */}
            <section className="gbl-karte" aria-labelledby="gbl-s2" data-feld="wahl">
              <p className="gbl-schritt"><span>2</span>Ihre Entscheidung</p>
              <h2 id="gbl-s2">Was soll mit ihr geschehen?</h2>
              <div className="gbl-wahl" role="radiogroup" aria-labelledby="gbl-s2">
                <button type="button" role="radio" aria-checked={wahl === "loeschen"} className={`gbl-option${wahl === "loeschen" ? " an" : ""}`} onClick={() => setWahl("loeschen")}>
                  <span className="gbl-option-punkt" aria-hidden="true" />
                  <b>Löschen</b>
                  <span className="gbl-option-satz">Wir lösen die Gesellschaft beim Bundesstaat auf.</span>
                  <ul>
                    <li>Auflösung und Löschung im Register</li>
                    <li>{sicht!.loeschungUsd} US-Dollar — die Rechnung kommt erst nach der Löschung</li>
                    <li>Ist noch ein steuerlicher Abschluss in den USA nötig, nennen wir die Kosten vorab</li>
                  </ul>
                </button>
                <button type="button" role="radio" aria-checked={wahl === "uebertragen"} className={`gbl-option${wahl === "uebertragen" ? " an" : ""}`} onClick={() => setWahl("uebertragen")}>
                  <span className="gbl-option-punkt" aria-hidden="true" />
                  <b>Übertragen</b>
                  <span className="gbl-option-satz">Sie übergeben die Gesellschaft an eine andere Person oder Firma.</span>
                  <ul>
                    <li>Übertragung der Anteile und neue Verantwortliche im Register</li>
                    <li>Ab der Übertragung trägt der neue Inhaber die laufenden Pflichten</li>
                    <li>Die Kosten nennen wir Ihnen vorab, bevor wir etwas einreichen</li>
                  </ul>
                </button>
              </div>
              {fehlerBei("wahl")}
            </section>

            {/* 3 — An wen? (nur bei Übertragung) */}
            {wahl === "uebertragen" && (
              <section className="gbl-karte gbl-auf" aria-labelledby="gbl-s3">
                <p className="gbl-schritt"><span>3</span>Der neue Inhaber</p>
                <h2 id="gbl-s3">An wen übertragen Sie?</h2>
                <div className="gbl-schalter" role="radiogroup" aria-label="Neuer Inhaber ist">
                  <button type="button" role="radio" aria-checked={art === "person"} className={art === "person" ? "an" : ""} onClick={() => setArt("person")}>Eine Person</button>
                  <button type="button" role="radio" aria-checked={art === "firma"} className={art === "firma" ? "an" : ""} onClick={() => setArt("firma")}>Eine Firma</button>
                </div>
                <div className="gbl-raster">
                  <label className="gbl-feld breit" data-feld="empfaenger.name">{art === "firma" ? "Name der Firma" : "Vor- und Nachname"}
                    <input value={eName} onChange={(e) => setEName(e.target.value)} autoComplete="off" />
                    {fehlerBei("empfaenger.name")}
                  </label>
                  {art === "firma" && (
                    <label className="gbl-feld breit" data-feld="empfaenger.vertreten">Vertreten durch
                      <input value={vertreten} onChange={(e) => setVertreten(e.target.value)} placeholder="Vor- und Nachname, Funktion" autoComplete="off" />
                      {fehlerBei("empfaenger.vertreten")}
                    </label>
                  )}
                  <label className="gbl-feld breit" data-feld="empfaenger.anschrift">Straße und Hausnummer
                    <input value={strasse} onChange={(e) => setStrasse(e.target.value)} autoComplete="off" />
                  </label>
                  <label className="gbl-feld">PLZ<input value={plz} onChange={(e) => setPlz(e.target.value)} autoComplete="off" inputMode="numeric" /></label>
                  <label className="gbl-feld">Ort<input value={ort} onChange={(e) => setOrt(e.target.value)} autoComplete="off" /></label>
                  <label className="gbl-feld breit">Land<input value={land} onChange={(e) => setLand(e.target.value)} autoComplete="off" />{fehlerBei("empfaenger.anschrift")}</label>
                  <label className="gbl-feld" data-feld="empfaenger.email">E-Mail
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
                    {fehlerBei("empfaenger.email")}
                  </label>
                  <label className="gbl-feld">Telefon <small>freiwillig</small><input type="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} autoComplete="off" /></label>
                  <label className="gbl-feld" data-feld="anteil">Übertragener Anteil in Prozent
                    <input inputMode="numeric" value={anteil} onChange={(e) => setAnteil(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} />
                    {fehlerBei("anteil")}
                  </label>
                  <label className="gbl-feld">Gewünschter Stichtag <small>freiwillig</small><input type="date" value={stichtag} onChange={(e) => setStichtag(e.target.value)} /></label>
                </div>
                <p className="gbl-klein">Der neue Inhaber unterschreibt die Übertragung digital — dafür brauchen wir seine E-Mail-Adresse.</p>
              </section>
            )}

            {/* Bestätigen */}
            {wahl && (
              <section className="gbl-karte gbl-auf gbl-bestaetigen" aria-labelledby="gbl-s4">
                <p className="gbl-schritt"><span>{wahl === "uebertragen" ? 4 : 3}</span>Bestätigen</p>
                <h2 id="gbl-s4">Ihre Weisung</h2>
                <label className="gbl-feld breit">Anmerkung <small>freiwillig — z. B. Wunschtermin oder Fragen</small>
                  <textarea value={anmerkung} onChange={(e) => setAnmerkung(e.target.value)} rows={3} maxLength={1500} />
                </label>
                <label className="gbl-feld breit" data-feld="bestaetigtMit">Ihr vollständiger Name
                  <input value={bestaetigt} onChange={(e) => setBestaetigt(e.target.value)} placeholder={sicht!.auftraggeber} autoComplete="name" />
                  {fehlerBei("bestaetigtMit")}
                </label>
                <label className="gbl-haken" data-feld="weisungBestaetigt">
                  <input type="checkbox" checked={weisungOk} onChange={(e) => setWeisungOk(e.target.checked)} />
                  <span>{wahl === "loeschen"
                    ? "Ich weise FIAON an, meine oben genannte Gesellschaft beim Bundesstaat auflösen und löschen zu lassen."
                    : "Ich weise FIAON an, die Übertragung meiner Anteile wie oben angegeben vorzubereiten und die neuen Verantwortlichen eintragen zu lassen."}</span>
                </label>
                {fehlerBei("weisungBestaetigt")}
                {fehler && !fehler.feld && <p className="gbl-fehler" role="alert">{fehler.text}</p>}
                <button type="button" className="gbl-knopf" disabled={sendet || !!sicht?.vorschau} onClick={() => void senden()}>
                  {sendet ? "Wird gesendet …" : "Weisung erteilen"}
                </button>
                <p className="gbl-klein">Sie erhalten sofort eine Kopie per E-Mail. Eingereicht wird erst, nachdem wir Ihnen die Unterlagen vorgelegt haben.</p>
              </section>
            )}
          </>
        )}
      </main>
    </Dunkel>
  );
}
