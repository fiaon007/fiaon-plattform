// Die Bildschirme 1–7 des neuen Antrags: Name, Kontakt, Geburtsdatum, Anschrift,
// Beruf, Einkommen, Einträge. Wortlaut aus dem freigegebenen Prototyp v2.
import { useEffect, useRef, useState } from "react";
import {
  BERUF_MIT_ARBEITGEBER, BERUF_TEXT, EINTRAEGE_FRAGE, EINTRAG_TEXT, LANDNAME, MONATE, PLZ_STELLEN, STAATEN, STAAT_AUS_LAND,
  ANTRAG_NEU_WERBE_HINWEIS, STAAT_LABEL, emailGueltig, einkommenGueltig, geburtPruefen,
  type Beruf, type Eintraege, type Land, type Seit, type Wohnen,
} from "@shared/fiaon-antrag-neu";
import { messungsDaten, metaEreignis, META_EREIGNIS } from "@/lib/werbung";
import { paketPreisCents } from "@shared/fiaon-pakete";
import { Feld, Ico, Knopf, Lead, Seg, Tipp, Tippbar, Titel, Warum, useAntrag, useFehler } from "./bausteine";
import { api } from "./api";
import { datenAus, paket, schoen } from "./zustand";

const SEIT_WERTE: [Seit, string][] = [["<1", "unter 1 Jahr"], ["1-5", "1–5 Jahre"], [">5", "über 5 Jahre"]];

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Name
// ═══════════════════════════════════════════════════════════════════════════
export function SchrittName() {
  const { S, setze, buehne, weiter, speichern, weiterText } = useAntrag();
  const f = useFehler("name");
  const los = () => {
    if (!S.anrede) return f.zeigen("anrede", "Bitte wählen Sie eine Anrede.");
    if (!S.vorname.trim()) return f.zeigen("vorname", "Bitte tragen Sie Ihren Vornamen ein.");
    if (!S.nachname.trim()) return f.zeigen("nachname", "Bitte tragen Sie Ihren Nachnamen ein.");
    const teil = { vorname: schoen(S.vorname), nachname: schoen(S.nachname) };
    setze(teil);
    if (S.ref) void speichern("name", teil);
    weiter();
  };
  return (
    <>
      <Titel text="Ihre Karte. Ihr Name." fokus={false} />
      <Lead>So, wie es in Ihrem Ausweis steht.</Lead>
      <div className="an-feld">
        <span className="an-etikett">Anrede</span>
        <Seg name="anrede" label="Anrede" werte={[["Frau", "Frau"], ["Herr", "Herr"], ["keine", "Ohne Anrede"]]} wahl={S.anrede}
          onWahl={(v) => { setze({ anrede: v }); f.weg("anrede"); }} fehlt={!!f.bei("anrede")} />
        {f.bei("anrede") ? <Tipp text={f.bei("anrede")!} /> : null}
      </div>
      <div className="an-reihe">
        <Feld id="vorname" label="Vorname" wert={S.vorname} fehler={f.bei("vorname")} autoComplete="given-name" autoCapitalize="words" enterKeyHint="next"
          onWert={(v) => { setze({ vorname: v }); f.weg("vorname"); buehne()?.nameNeu(); }} />
        <Feld id="nachname" label="Nachname" wert={S.nachname} fehler={f.bei("nachname")} autoComplete="family-name" autoCapitalize="words" enterKeyHint="next"
          onWert={(v) => { setze({ nachname: v }); f.weg("nachname"); buehne()?.nameNeu(); }} />
      </div>
      <Warum text="Ihr Name steht genau so auf Ihrem Vertrag – und so beantragen Sie später auch Ihre Karte bei der Bank." />
      <Knopf text={weiterText("Weiter")} onClick={los} />
      <div className="an-fuss-zeile">
        Rund drei Minuten · Ihre Angaben werden laufend gespeichert. Wir verarbeiten sie für Ihren Antrag und Vertrag – mehr in der{" "}
        <a href="/datenschutz" target="_blank" rel="noopener" style={{ color: "inherit" }}>Datenschutzerklärung</a>.
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Kontakt — hier entsteht der Antrag auf dem Server
// ═══════════════════════════════════════════════════════════════════════════
const EMAIL_FEHLER: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.de": "gmail.com", "gmal.com": "gmail.com", "gmx.d": "gmx.de", "gmxde": "gmx.de",
  "gmx.ed": "gmx.de", "gmx.nett": "gmx.net", "wed.de": "web.de", "web.d": "web.de", "webde": "web.de", "tonline.de": "t-online.de",
  "t-onlien.de": "t-online.de", "t-online.d": "t-online.de", "hotmial.com": "hotmail.com", "hotmail.d": "hotmail.de", "yaho.de": "yahoo.de",
  "outlok.de": "outlook.de", "outlook.d": "outlook.de", "icloud.de": "icloud.com", "iclod.com": "icloud.com", "bluewin.c": "bluewin.ch", "gmx.a": "gmx.at",
};
const ENDUNGEN: Record<Land, string[]> = {
  DE: ["gmx.de", "web.de", "t-online.de", "gmail.com", "outlook.de"],
  AT: ["gmx.at", "gmail.com", "aon.at", "a1.net", "outlook.com"],
  CH: ["bluewin.ch", "gmx.ch", "gmail.com", "outlook.com", "hotmail.com"],
};
const LAND_AUS_VORWAHL: Record<string, Land> = { "+49": "DE", "+43": "AT", "+41": "CH" };

export function SchrittKontakt() {
  const { S, setze, aktuell, gehe, weiter, speichern, weiterText, sitzung, toast } = useAntrag();
  const f = useFehler("kontakt");
  const [telRoh, setTelRoh] = useState(S.telefon);
  const [telHinweis, setTelHinweis] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [bekannt, setBekannt] = useState<{ email: string; hatPasswort: boolean } | null>(null);
  const telRef = useRef<HTMLInputElement>(null);

  const domain = (S.email.split("@")[1] || "").toLowerCase();
  const vorschlag = EMAIL_FEHLER[domain];
  const at = S.email.indexOf("@");
  const zeigeEndungen = at > 0 && S.email.slice(at + 1).length < 3;
  const endungen = ENDUNGEN[LAND_AUS_VORWAHL[S.vorwahl] ?? "DE"];

  // Gibt es zu dieser Adresse schon ein Konto? Dann ein ruhiger Hinweis (nichts wird blockiert).
  useEffect(() => {
    const e = S.email.trim().toLowerCase();
    if (!emailGueltig(e)) { setBekannt(null); return; }
    const t = window.setTimeout(async () => {
      const r = await api.emailBekannt(e, S.ref);
      if (r.json && (r.json as any).bekannt) setBekannt({ email: e, hatPasswort: !!(r.json as any).hatPasswort });
      else setBekannt(null);
    }, 650);
    return () => clearTimeout(t);
  }, [S.email, S.ref]);

  const telefonTippen = (roh: string) => {
    f.weg("telefon");
    const kompakt = roh.replace(/[\s\-/()]/g, "");
    // Mitten im Tippen einer Vorwahl („+", „00", „+4") nichts umformen.
    if (/^(\+|0{1,2}|\+?[1-9])$/.test(kompakt) || (/^(\+|00)(4|[1-9]\d?)$/.test(kompakt) && !/^(\+|00)(49|43|41)/.test(kompakt))) {
      setTelRoh(roh); setze({ telefon: "" }); return;
    }
    let hin = "";
    let ziffern: string;
    const m = kompakt.match(/^(?:\+|00)(49|43|41)(\d*)$/);
    if (m) { setze({ vorwahl: `+${m[1]}` }); ziffern = m[2]; hin = "Die Ländervorwahl haben wir links übernommen."; }
    else if (/^(\+|00)\d/.test(kompakt)) {
      setTelRoh(roh); setze({ telefon: "" });
      setTelHinweis("Anträge nehmen wir derzeit nur mit einer Nummer aus Deutschland, Österreich oder der Schweiz an.");
      return;
    } else ziffern = kompakt.replace(/\D/g, "");
    if (ziffern.charAt(0) === "0") { ziffern = ziffern.replace(/^0+/, ""); hin = "Die Null am Anfang lassen wir weg, so ist es richtig."; }
    const schoenTel = ziffern.slice(0, 13).replace(/^(\d{3})(\d{0,4})(\d{0,6}).*/, (_x, a, b, c) => [a, b, c].filter(Boolean).join(" "));
    setTelRoh(schoenTel); setze({ telefon: schoenTel }); setTelHinweis(hin);
  };

  // Eine Anlage zur Zeit: Ein zweiter Druck (Enter, Go-Taste, Doppelklick) während der
  // Anfrage läuft, legte sonst einen zweiten Antrag an.
  const laeuft = useRef(false);
  const los = async () => {
    if (laeuft.current) return;
    const email = S.email.trim().toLowerCase();
    if (!emailGueltig(email)) return f.zeigen("email", "Bitte prüfen Sie Ihre E-Mail-Adresse, zum Beispiel name@gmx.de.");
    if (S.telefon.replace(/\D/g, "").length < 9) return f.zeigen("telefon", "Bitte tragen Sie Ihre Mobilnummer ein, zum Beispiel 151 2345 6789.");
    setze({ email });
    if (aktuell().ref) { void speichern("kontakt", { email }); weiter(); return; }
    laeuft.current = true;
    setLaedt(true);
    try {
      let leadLink: string | null = null;
      try { leadLink = sessionStorage.getItem("fiaon_lead_link"); } catch { /* egal */ }
      const r = await api.anlegen({ ...datenAus(aktuell()), email }, { leadLink, messung: messungsDaten(), sitzung });
      if (!r.ok || !r.json?.ref) {
        const j: any = r.json;
        if (j?.feld) return f.zeigen(j.feld, j.error || "Bitte prüfen Sie diese Angabe.");
        // Der Server schickt zurück an einen früheren Bildschirm (z. B. Name fehlt).
        if (j?.schritt && j.schritt !== "kontakt") { gehe(j.schritt, { richtung: "zurueck", hinweis: { text: j.error || "Bitte ergänzen Sie hier noch Ihre Angaben." } }); return; }
        toast(j?.error || "Keine Verbindung. Bitte versuchen Sie es gleich noch einmal.");
        return;
      }
      const ref = r.json.ref;
      setze({ ref, email });
      // E-283: Wert = Monatsrate des (vor)gewählten Pakets, wie im alten Antrag (dort pack.fee) — vorher 0.
      metaEreignis(META_EREIGNIS.antragBegonnen, ref, { content_name: paket(S.paket).name, value: paketPreisCents(S.paket) / 100 });
      weiter();
    } finally {
      laeuft.current = false;
      setLaedt(false);
    }
  };

  return (
    <>
      <Titel text="Wie erreichen wir Sie?" />
      <Lead>An Ihre E-Mail-Adresse schicken wir Ihren Vertrag.</Lead>
      <div className="an-feld">
        <label htmlFor="an-email">E-Mail-Adresse</label>
        <input className={`an-eingabe${f.bei("email") ? " an-fehlt" : ""}`} id="an-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="off"
          spellCheck={false} placeholder="name@beispiel.de" value={S.email}
          onChange={(e) => { setze({ email: e.target.value.replace(/\s/g, "") }); f.weg("email"); }} />
        {f.bei("email") ? <Tipp text={f.bei("email")!} /> : null}
        {vorschlag && !f.bei("email") ? (
          <div className="an-tipp" style={{ color: "var(--tief)", background: "var(--akzent-hauch)" }}>
            Meinten Sie <b style={{ fontWeight: 600 }}>{S.email.split("@")[0]}@{vorschlag}</b>?{" "}
            <button type="button" className="an-knopf an-text" style={{ fontSize: "inherit", minHeight: 0 }}
              onClick={() => setze({ email: `${S.email.split("@")[0]}@${vorschlag}` })}>Übernehmen</button>
          </div>
        ) : null}
        {zeigeEndungen ? (
          <div className="an-chips" style={{ marginTop: 2 }}>
            {endungen.map((d) => (
              <button key={d} type="button" className="an-chip" onClick={() => { setze({ email: `${S.email.split("@")[0]}@${d}` }); telRef.current?.focus(); }}>@{d}</button>
            ))}
          </div>
        ) : null}
        {bekannt && bekannt.email === S.email.trim().toLowerCase() && bekannt.hatPasswort ? (
          <div className="an-warum-text">
            Zu dieser Adresse gibt es schon ein FIAON-Konto. <a href={`/app/login?email=${encodeURIComponent(bekannt.email)}`} style={{ color: "var(--tief)" }}>Anmelden</a> – oder hier einfach weitermachen.
          </div>
        ) : null}
      </div>
      <div className="an-feld">
        <span className="an-etikett">Mobilnummer</span>
        <div className="an-tel">
          <select className="an-eingabe" aria-label="Ländervorwahl" value={S.vorwahl} onChange={(e) => setze({ vorwahl: e.target.value })}>
            <option value="+49">+49</option><option value="+43">+43</option><option value="+41">+41</option>
          </select>
          <input ref={telRef} className={`an-eingabe${f.bei("telefon") ? " an-fehlt" : ""}`} id="an-telefon" type="tel" inputMode="tel" autoComplete="tel-national"
            placeholder="151 2345 6789" value={telRoh} aria-label="Mobilnummer" onChange={(e) => telefonTippen(e.target.value)} />
        </div>
        {f.bei("telefon") ? <Tipp text={f.bei("telefon")!} /> : telHinweis ? <div className="an-klein">{telHinweis}</div> : null}
      </div>
      <Warum text="Ihre feste Betreuung erreicht Sie telefonisch. Ihre Nummer geben wir nicht weiter." />
      <p className="an-klein" style={{ margin: 0 }}>{ANTRAG_NEU_WERBE_HINWEIS}</p>
      <Knopf text={laedt ? "Wird gespeichert …" : weiterText("Weiter")} onClick={() => void los()} laedt={laedt} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · Geburtsdatum
// ═══════════════════════════════════════════════════════════════════════════
export function SchrittGeburt() {
  const { S, setze, weiter, speichern, weiterText } = useAntrag();
  const f = useFehler("geburt");
  const ids = ["gt", "gm", "gj"] as const;
  const refs = { gt: useRef<HTMLInputElement>(null), gm: useRef<HTMLInputElement>(null), gj: useRef<HTMLInputElement>(null) };
  const stand = geburtPruefen(S);
  const ruecklesen = stand === "ok" ? `${Number(S.gt)}. ${MONATE[Number(S.gm) - 1]} ${S.gj}` : "";
  const hinweis = stand === "ungueltig" ? "Diesen Tag gibt es nicht. Bitte prüfen Sie Tag und Monat."
    : stand === "jung" ? "Den Vertrag können Sie ab 18 Jahren schließen." : stand === "alt" ? "Bitte prüfen Sie das Jahr." : "";

  const tippen = (id: typeof ids[number], i: number, roh: string) => {
    let v = roh.replace(/\D/g, "");
    if (id === "gt" && v.length === 1 && Number(v) > 3) v = `0${v}`;
    if (id === "gm" && v.length === 1 && Number(v) > 1) v = `0${v}`;
    v = v.slice(0, id === "gj" ? 4 : 2);
    setze({ [id]: v } as any);
    f.weg();
    if (v.length >= (id === "gj" ? 4 : 2) && i < 2) refs[ids[i + 1]].current?.focus();
  };
  const einfuegen = (e: React.ClipboardEvent) => {
    const t = e.clipboardData.getData("text");
    const m = t.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{4})/);
    if (m) { e.preventDefault(); setze({ gt: `0${m[1]}`.slice(-2), gm: `0${m[2]}`.slice(-2), gj: m[3] }); f.weg(); }
  };
  const los = () => {
    if (!S.gt) return f.zeigen("gt", "Bitte tragen Sie den Tag ein.");
    if (!S.gm) return f.zeigen("gm", "Bitte tragen Sie den Monat ein.");
    if (S.gj.length !== 4) return f.zeigen("gj", "Bitte tragen Sie das Jahr mit vier Ziffern ein.");
    if (stand !== "ok") return f.zeigen("gj", hinweis || "Bitte prüfen Sie Ihr Geburtsdatum.");
    void speichern("geburt");
    weiter();
  };
  const feld = (id: typeof ids[number], i: number, label: string, ph: string, ac: string) => (
    <div className="an-feld">
      <label htmlFor={`an-${id}`}>{label}</label>
      <input ref={refs[id]} className={`an-eingabe an-ziffer${f.fehler && (f.fehler.feld === id || (f.fehler.feld === "gj" && stand !== "ok" && stand !== "fehlt")) ? " an-fehlt" : ""}`}
        id={`an-${id}`} inputMode="numeric" maxLength={id === "gj" ? 4 : 2} placeholder={ph} value={S[id]} autoComplete={ac}
        onChange={(e) => tippen(id, i, e.target.value)} onPaste={einfuegen}
        onKeyDown={(e) => {
          // Enter läuft über die Panel-Taste (mit Sperre während des Wechsels) — hier nur Rückschritt.
          if (e.key === "Backspace" && !S[id] && i > 0) refs[ids[i - 1]].current?.focus();
        }} />
    </div>
  );
  return (
    <>
      <Titel text="Ihr Geburtsdatum" />
      <Lead>Tag, Monat, Jahr – die Felder springen von selbst weiter.</Lead>
      <div className="an-ziffern">
        {feld("gt", 0, "Tag", "TT", "bday-day")}<div className="an-punkt">.</div>
        {feld("gm", 1, "Monat", "MM", "bday-month")}<div className="an-punkt">.</div>
        {feld("gj", 2, "Jahr", "JJJJ", "bday-year")}
      </div>
      <div className="an-ruecklesen" aria-live="polite">
        {f.fehler ? <span className="an-tipp" style={{ display: "inline-block" }}>{f.fehler.text}</span>
          : hinweis && S.gj.length === 4 ? <span className="an-tipp" style={{ display: "inline-block" }}>{hinweis}</span> : ruecklesen}
      </div>
      <Warum text="Den Vertrag können Sie ab 18 Jahren schließen. Ihr Geburtsdatum hilft außerdem, Sie eindeutig zu erkennen." />
      <Knopf text={weiterText("Weiter")} onClick={los} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Anschrift — Vorschläge aus dem Adressverzeichnis (/api/fiaon/adresse)
// ═══════════════════════════════════════════════════════════════════════════
type Vorschlag = { strasse: string; plz: string; ort: string; land: Land; vollstaendig: boolean };
const NUMMER = /^(.*\S)\s+(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)$/;

export function SchrittAdresse() {
  const { S, setze, weiter, speichern, weiterText, toast, ereignis } = useAntrag();
  const f = useFehler("adresse");
  const [such, setSuch] = useState("");
  const [liste, setListe] = useState<Vorschlag[]>([]);
  const [laedt, setLaedt] = useState(false);
  const ab = useRef<AbortController | null>(null);
  const zeit = useRef<number | null>(null);
  const nrRef = useRef<HTMLInputElement>(null);
  const strRef = useRef<HTMLInputElement>(null);
  const sucheRef = useRef<HTMLInputElement>(null);

  // Wer mit +43/+41 kam und noch nichts gewählt hat, wohnt vermutlich dort.
  useEffect(() => {
    if (!S.strasse && !S.staatArt) {
      const l = LAND_AUS_VORWAHL[S.vorwahl];
      if (l && l !== S.land) setze({ land: l });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const suchen = (q: string, land: Land) => {
    if (zeit.current) clearTimeout(zeit.current);
    const frage = q.trim();
    if (frage.length < 3) { setListe([]); return; }
    zeit.current = window.setTimeout(async () => {
      ab.current?.abort();
      const c = new AbortController(); ab.current = c;
      setLaedt(true);
      const j = await api.adresse(frage, land, c.signal);
      if (c.signal.aborted) return;
      setLaedt(false);
      setListe(Array.isArray(j?.vorschlaege) ? j.vorschlaege.slice(0, 5) : []);
    }, 160);
  };
  useEffect(() => () => { ab.current?.abort(); if (zeit.current) clearTimeout(zeit.current); }, []);

  const oeffnen = (fokus?: "nr" | "strasse") => {
    setze({ adresseOffen: true });
    if (fokus) setTimeout(() => (fokus === "nr" ? nrRef : strRef).current?.focus(), 320);
  };
  const waehlen = (v: Vorschlag) => {
    let strasse = v.strasse, nr = "";
    const m = v.strasse.match(NUMMER);
    if (v.vollstaendig && m) { strasse = m[1]; nr = m[2].replace(/\s+/g, ""); }
    else {
      // Vorschlag ohne Hausnummer: die getippte Nummer bleibt (Justin, 23.08.2026: „Hausnummer muss angeführt werden").
      const getippt = such.match(/(\d+\s*[a-zA-Z]?)\s*$/);
      if (getippt) nr = getippt[1].replace(/\s+/g, "");
    }
    setze({ strasse, nr, plz: v.plz, ort: v.ort, land: v.land || S.land, adresseQuelle: "vorschlag", adresseOffen: true });
    ereignis("adresse_gewaehlt", { schritt: "adresse", detail: nr ? "vollstaendig" : "ohne_nr" });
    setListe([]); f.weg();
    if (!nr) { toast("Bitte ergänzen Sie noch die Hausnummer."); setTimeout(() => nrRef.current?.focus(), 320); }
  };
  const landWaehlen = (l: Land) => {
    setze({ land: l, ...(S.staatArt === "land" ? { staat: STAAT_AUS_LAND[l] } : {}) });
    if (such.trim().length > 2) suchen(such, l);
  };
  const los = () => {
    const len = PLZ_STELLEN[S.land];
    if (!S.adresseOffen) return f.zeigen("suche", such.trim().length > 2 ? "Bitte wählen Sie Ihre Adresse aus der Liste – oder geben Sie sie selbst ein." : "Bitte tragen Sie Straße und Hausnummer ein.");
    if (!S.strasse.trim()) return f.zeigen("strasse", "Bitte tragen Sie die Straße ein.");
    if (!S.nr.trim()) return f.zeigen("nr", "Bitte tragen Sie die Hausnummer ein.");
    if (!new RegExp(`^\\d{${len}}$`).test(S.plz)) return f.zeigen("plz", `Die Postleitzahl hat in ${LANDNAME[S.land]} ${len} Ziffern.`);
    if (!S.ort.trim()) return f.zeigen("ort", "Bitte tragen Sie den Ort ein.");
    if (!S.staatArt) return f.zeigen("staatArt", "Bitte wählen Sie Ihre Staatsangehörigkeit.");
    if (S.staatArt === "andere" && !S.staat) return f.zeigen("staat", "Bitte wählen Sie Ihre Staatsangehörigkeit aus der Liste.");
    if (S.staat === "andere" && !S.staatText.trim()) return f.zeigen("staatText", "Bitte nennen Sie Ihre Staatsangehörigkeit.");
    const teil = { strasse: schoen(S.strasse), ort: schoen(S.ort) };
    setze(teil);
    void speichern("adresse", teil);
    weiter();
  };

  return (
    <>
      <Titel text="Ihre Anschrift" />
      <Lead>Tippen Sie Straße und Hausnummer – wir ergänzen den Rest.</Lead>
      <Seg name="land" label="Land" werte={[["DE", "Deutschland"], ["AT", "Österreich"], ["CH", "Schweiz"]]} wahl={S.land} onWahl={landWaehlen} />
      {!S.adresseOffen ? (
        <div className="an-feld">
          <label htmlFor="an-suche">Straße und Hausnummer</label>
          <input ref={sucheRef} className={`an-eingabe${f.bei("suche") ? " an-fehlt" : ""}`} id="an-suche" autoComplete="off" placeholder="z. B. Musterstraße 12" enterKeyHint="search"
            value={such} onChange={(e) => { setSuch(e.target.value); f.weg("suche"); suchen(e.target.value, S.land); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (liste[0]) waehlen(liste[0]); } }}
            role="combobox" aria-expanded={liste.length > 0} aria-controls="an-vorschlaege" aria-autocomplete="list" />
          {f.bei("suche") ? <Tipp text={f.bei("suche")!} /> : null}
          {liste.length ? (
            <div className="an-vorschlaege" role="listbox" id="an-vorschlaege">
              {liste.map((v, i) => (
                <button key={`${v.strasse}-${v.plz}-${i}`} type="button" className="an-vorschlag" role="option" aria-selected={i === 0} onClick={() => waehlen(v)}>
                  <Ico name="pin" klasse="" />
                  <span>{v.strasse}<small>{v.plz} {v.ort} · {LANDNAME[v.land] ?? v.land}</small></span>
                </button>
              ))}
            </div>
          ) : laedt ? <div className="an-klein">Suche läuft …</div> : null}
          <button type="button" className="an-knopf an-text" style={{ alignSelf: "flex-start", marginTop: 2 }}
            onClick={() => { const m = such.trim().match(NUMMER); setze({ adresseQuelle: "hand", ...(m ? { strasse: schoen(m[1]), nr: m[2] } : such.trim() ? { strasse: schoen(such.trim()) } : {}) }); oeffnen(m ? undefined : "strasse"); }}>
            Adresse selbst eingeben
          </button>
        </div>
      ) : null}
      <div className={`an-klapp${S.adresseOffen ? " an-offen" : ""}`}>
        <div>
          <div className="an-reihe an-str">
            <div className="an-feld">
              <label htmlFor="an-strasse">Straße</label>
              <input ref={strRef} className={`an-eingabe${f.bei("strasse") ? " an-fehlt" : ""}`} id="an-strasse" autoComplete="address-line1" value={S.strasse}
                onChange={(e) => { setze({ strasse: e.target.value, adresseQuelle: "hand" }); f.weg("strasse"); }} />
            </div>
            <div className="an-feld">
              <label htmlFor="an-nr">Nr.</label>
              <input ref={nrRef} className={`an-eingabe${f.bei("nr") ? " an-fehlt" : ""}`} id="an-nr" autoComplete="off" value={S.nr}
                onChange={(e) => { setze({ nr: e.target.value.slice(0, 16) }); f.weg("nr"); }} />
            </div>
          </div>
          {f.bei("strasse") ? <Tipp text={f.bei("strasse")!} /> : f.bei("nr") ? <Tipp text={f.bei("nr")!} /> : null}
          <div className="an-reihe an-ort">
            <Feld id="plz" label="PLZ" wert={S.plz} fehler={null} inputMode="numeric" maxLength={PLZ_STELLEN[S.land]} autoComplete="postal-code"
              onWert={(v) => { setze({ plz: v.replace(/\D/g, "").slice(0, PLZ_STELLEN[S.land]), adresseQuelle: "hand" }); f.weg("plz"); }} />
            <Feld id="ort" label="Ort" wert={S.ort} fehler={null} autoComplete="address-level2"
              onWert={(v) => { setze({ ort: v, adresseQuelle: "hand" }); f.weg("ort"); }} />
          </div>
          {f.bei("plz") ? <Tipp text={f.bei("plz")!} /> : f.bei("ort") ? <Tipp text={f.bei("ort")!} /> : null}
          <button type="button" className="an-knopf an-text" style={{ alignSelf: "flex-start" }}
            onClick={() => { setze({ adresseOffen: false }); setSuch(""); setListe([]); setTimeout(() => sucheRef.current?.focus(), 60); }}>
            Andere Adresse suchen
          </button>
        </div>
      </div>
      <div className="an-feld">
        <span className="an-etikett">Ihre Staatsangehörigkeit</span>
        <Seg name="staatArt" label="Staatsangehörigkeit" werte={[["land", STAAT_LABEL[S.land]], ["andere", "Andere"]]} wahl={S.staatArt} fehlt={!!f.bei("staatArt")}
          onWahl={(v) => {
            f.weg("staatArt");
            if (v === "land") setze({ staatArt: "land", staat: STAAT_AUS_LAND[S.land], staatText: "" });
            else { setze({ staatArt: "andere", staat: STAATEN.includes(S.staat) && S.staat !== STAAT_AUS_LAND[S.land] ? S.staat : "" }); setTimeout(() => document.getElementById("an-staat")?.focus(), 350); }
          }} />
        {f.bei("staatArt") ? <Tipp text={f.bei("staatArt")!} /> : null}
      </div>
      <div className={`an-klapp${S.staatArt === "andere" ? " an-offen" : ""}`}>
        <div>
          <div className="an-feld">
            <label htmlFor="an-staat">Welche Staatsangehörigkeit?</label>
            <select className={`an-eingabe${f.bei("staat") ? " an-fehlt" : ""}`} id="an-staat" value={S.staatArt === "andere" ? S.staat : ""}
              onChange={(e) => { setze({ staat: e.target.value }); f.weg("staat"); }}>
              <option value="">Bitte wählen</option>
              {STAATEN.map((x) => <option key={x} value={x}>{x.charAt(0).toUpperCase() + x.slice(1)}</option>)}
            </select>
            {f.bei("staat") ? <Tipp text={f.bei("staat")!} /> : null}
          </div>
          <div className={`an-klapp${S.staat === "andere" ? " an-offen" : ""}`}>
            <div>
              <Feld id="staatText" label="Bitte nennen Sie Ihre Staatsangehörigkeit" wert={S.staatText} fehler={f.bei("staatText")} autoComplete="off"
                onWert={(v) => { setze({ staatText: v }); f.weg("staatText"); }} />
            </div>
          </div>
        </div>
      </div>
      <Warum text="An diese Anschrift gehen Ihre Unterlagen. Sie muss zu Ihrem Ausweis passen." />
      <Knopf text={weiterText("Weiter")} onClick={los} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · Beruf
// ═══════════════════════════════════════════════════════════════════════════
export function SchrittBeruf() {
  const { S, setze, weiter, speichern, weiterText } = useAntrag();
  const f = useFehler("beruf");
  const mitAG = !!S.beruf && BERUF_MIT_ARBEITGEBER.includes(S.beruf as Beruf);
  const mitSelbst = S.beruf === "selbst";
  const los = () => {
    if (!S.beruf) return f.zeigen("beruf", "Bitte wählen Sie eine Antwort.");
    if (mitAG && !S.arbeitgeber.trim()) return f.zeigen("arbeitgeber", "Bitte tragen Sie Ihren Arbeitgeber ein.");
    if (mitAG && !S.seit) return f.zeigen("seit", "Bitte wählen Sie, seit wann Sie dort beschäftigt sind.");
    if (mitSelbst && !S.branche.trim()) return f.zeigen("branche", "Bitte tragen Sie Ihre Branche ein.");
    if (mitSelbst && !S.seit) return f.zeigen("seitS", "Bitte wählen Sie, seit wann Sie selbstständig sind.");
    void speichern("beruf");
    weiter();
  };
  return (
    <>
      <Titel text="Ihre berufliche Situation" />
      <Lead>Jede Antwort ist richtig. Wir planen mit dem, was ist.</Lead>
      <div className={`an-liste${f.bei("beruf") ? " an-fehlt" : ""}`} role="radiogroup" data-feld="beruf" aria-label="Berufliche Situation">
        {(Object.keys(BERUF_TEXT) as Beruf[]).map((k) => (
          <button key={k} type="button" className="an-zeile-w" role="radio" aria-checked={S.beruf === k}
            onClick={() => { setze({ beruf: k, seit: S.beruf === k ? S.seit : "" }); f.weg(); }}>
            <Ico name={k} /><span>{BERUF_TEXT[k]}</span><span className="an-rund" />
          </button>
        ))}
      </div>
      {f.bei("beruf") ? <Tipp text={f.bei("beruf")!} /> : null}
      <div className={`an-klapp${mitAG ? " an-offen" : ""}`}>
        <div>
          <Feld id="arbeitgeber" label="Arbeitgeber" wert={S.arbeitgeber} fehler={f.bei("arbeitgeber")} autoComplete="organization" placeholder="z. B. Stadtwerke Berlin"
            onWert={(v) => { setze({ arbeitgeber: v }); f.weg("arbeitgeber"); }} />
          <div className="an-feld">
            <span className="an-etikett">Beschäftigt seit</span>
            <Seg name="seit" label="Beschäftigt seit" werte={SEIT_WERTE} wahl={mitAG ? S.seit : ""} fehlt={!!f.bei("seit")} onWahl={(v) => { setze({ seit: v }); f.weg("seit"); }} />
            {f.bei("seit") ? <Tipp text={f.bei("seit")!} /> : null}
          </div>
        </div>
      </div>
      <div className={`an-klapp${mitSelbst ? " an-offen" : ""}`}>
        <div>
          <Feld id="branche" label="Branche" wert={S.branche} fehler={f.bei("branche")} placeholder="z. B. Handwerk, Gastronomie"
            onWert={(v) => { setze({ branche: v }); f.weg("branche"); }} />
          <div className="an-feld">
            <span className="an-etikett">Selbstständig seit</span>
            <Seg name="seitS" label="Selbstständig seit" werte={SEIT_WERTE} wahl={mitSelbst ? S.seit : ""} fehlt={!!f.bei("seitS")} onWahl={(v) => { setze({ seit: v }); f.weg("seitS"); }} />
            {f.bei("seitS") ? <Tipp text={f.bei("seitS")!} /> : null}
          </div>
        </div>
      </div>
      <Warum text="Damit Ihre Betreuung Ihren Weg realistisch plant. Wir geben Ihre Angaben nicht an Banken oder Auskunfteien weiter." />
      <Knopf text={weiterText("Weiter")} onClick={los} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · Einkommen und Wohnsituation
// ═══════════════════════════════════════════════════════════════════════════
const WOHNEN_KACHELN: [Wohnen, string, string][] = [["miete", "Zur Miete", "miete"], ["eigentum", "Wohneigentum", "eigentum"], ["familie", "Bei Eltern oder Familie", "familie"], ["sonstige", "Sonstige", "sonst"]];
export function SchrittEinkommen() {
  const { S, setze, weiter, speichern, weiterText } = useAntrag();
  const f = useFehler("einkommen");
  const los = () => {
    const n = Number(S.einkommen);
    if (!n) return f.zeigen("einkommen", "Bitte tragen Sie Ihr Nettoeinkommen im Monat ein.");
    if (!einkommenGueltig(S.einkommen)) return f.zeigen("einkommen", "Bitte prüfen Sie den Betrag – gemeint ist Ihr Einkommen im Monat.");
    if (!S.wohnen) return f.zeigen("wohnen", "Bitte wählen Sie Ihre Wohnsituation.");
    void speichern("einkommen");
    weiter();
  };
  return (
    <>
      <Titel text="Ihr Einkommen" />
      <Lead>Ihr monatliches Nettoeinkommen – Rente oder Pension eingeschlossen.</Lead>
      <div className="an-feld">
        <label htmlFor="an-einkommen">Netto im Monat</label>
        <div className="an-einheit-feld">
          <input className={`an-eingabe${f.bei("einkommen") ? " an-fehlt" : ""}`} id="an-einkommen" inputMode="numeric" autoComplete="off" placeholder="0"
            value={S.einkommen ? Number(S.einkommen).toLocaleString("de-DE") : ""}
            onChange={(e) => { setze({ einkommen: e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 6) }); f.weg("einkommen"); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
          <span className="an-einheit">€</span>
        </div>
        {f.bei("einkommen") ? <Tipp text={f.bei("einkommen")!} /> : null}
      </div>
      <div className="an-feld">
        <span className="an-etikett">Ihre Wohnsituation</span>
        <div className={`an-raster${f.bei("wohnen") ? " an-fehlt" : ""}`} data-feld="wohnen" role="radiogroup" aria-label="Wohnsituation">
          {WOHNEN_KACHELN.map(([k, t, ico]) => (
            <button key={k} type="button" className="an-kachel an-flach" role="radio" aria-checked={S.wohnen === k} aria-pressed={S.wohnen === k}
              onClick={() => { setze({ wohnen: k }); f.weg("wohnen"); }}>
              <Ico name={ico} /><span>{t}</span>
            </button>
          ))}
        </div>
        {f.bei("wohnen") ? <Tipp text={f.bei("wohnen")!} /> : null}
      </div>
      <Warum text="Ihr Einkommen hilft Ihrer Betreuung, Ihren Spielraum und Ihr Ziel-Limit realistisch zu planen. Wir geben es nicht an Banken oder Auskunfteien weiter." />
      <Knopf text={weiterText("Weiter")} onClick={los} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · Negative Einträge (Pflichtfrage, je Land)
// ═══════════════════════════════════════════════════════════════════════════
function trostText(e: Eintraege | ""): string {
  return e === "ja" ? "Gut, dass Sie es sagen – genau dafür sind wir da. Ihre Betreuung plant Ihren Weg damit."
    : e === "nein" ? "Sehr gut. Dann planen wir Ihren Weg zur Karte direkt."
      : e === "weiss_nicht" ? "Kein Problem – das klären wir gemeinsam mit Ihrer Auskunft." : "";
}
export function SchrittEintraege() {
  const { S, setze, gehe, speichern, weiterText, weiter } = useAntrag();
  const f = useFehler("eintraege");
  const frage = EINTRAEGE_FRAGE[S.land] ?? EINTRAEGE_FRAGE.DE;
  const [getippt, setGetippt] = useState(false);
  const los = () => {
    if (!S.eintraege) return f.zeigen("eintraege", "Bitte wählen Sie eine Antwort.");
    void speichern("eintraege");
    // Nach „Angaben ändern" geht es zurück, ohne die Prüfung erneut zu durchlaufen.
    if (S.rueckZu && S.geprueftAm) { weiter(); return; }
    gehe("pruefung");
  };
  return (
    <>
      <Titel text={frage.titel} />
      <Lead>{frage.lead}</Lead>
      <div className={`an-liste${f.bei("eintraege") ? " an-fehlt" : ""}`} role="radiogroup" data-feld="eintraege" aria-label={frage.titel}>
        {(Object.keys(EINTRAG_TEXT) as Eintraege[]).map((k) => (
          <button key={k} type="button" className="an-zeile-w" style={{ gridTemplateColumns: "1fr 18px" }} role="radio" aria-checked={S.eintraege === k}
            onClick={() => { setze({ eintraege: k }); setGetippt(true); f.weg(); }}>
            <span>{EINTRAG_TEXT[k]}</span><span className="an-rund" />
          </button>
        ))}
      </div>
      {f.bei("eintraege") ? <Tipp text={f.bei("eintraege")!} /> : null}
      <div className={`an-klapp${S.eintraege ? " an-offen" : ""}`}>
        <div>{S.eintraege ? <Tippbar text={trostText(S.eintraege)} klasse="an-lead" tag="p" animiert={getippt} ms={16} /> : null}</div>
      </div>
      <Knopf text={S.rueckZu && S.geprueftAm ? weiterText("Weiter") : "Antrag prüfen lassen"} onClick={los} />
    </>
  );
}
