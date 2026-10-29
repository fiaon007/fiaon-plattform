// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER PERSÖNLICHE ZUGANG (E-423, 22.10.2026)
//
// Justin: „Der Kunde soll seinen eigenen Zugang bekommen, wo er sich anmeldet —
// mit E-Mail-Authentifizierung, also wir senden einen Code, das fühlt sich
// einfach besser an."
//
// Eine Seite, vier Adressen (deutsch / englisch):
//   /business/login              E-Mail + Passwort → sechsstelliger Code → „Mein Auftrag“
//   /business/passwort-vergessen Link für ein neues Passwort (antwortet immer gleich)
//   /business/zugang#e=… | #p=…  Zugang einrichten / neues Passwort → Code → angemeldet
//   /business/konto              „Ihre Aufträge“ — wer mehr als einen Auftrag hat
// Der Link der Mail trägt sein Geheimnis im ANKER (#…): Er erreicht nie einen Server-Log
// und keinen Referrer; die Seite nimmt ihn sofort aus der Adresszeile.
// Gestaltung: dieselbe Welt wie das Portal (global-konto.css) — Papier, Navy, Blau, Glas
// nur an der Karte. Die Server-Sätze kommen aus shared/fiaon-global-konto.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { useLocation } from "wouter";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";
import { useSprache, useWoerter } from "@/i18n/sprache";
import { GLOBAL_KONTO_WOERTER } from "@/i18n/global-konto";
import { KONTO_PFADE, passwortBewerten } from "@shared/fiaon-global-konto";
import { VORBELEGUNG_SCHLUESSEL } from "@/components/site/GlobalKontoLeiste";
import "@/styles/global-konto.css";
import "@/styles/global-apple.css";

type Modus = "login" | "vergessen" | "zugang" | "konto";
type Meldung = { art: "fehler" | "gut" | "info"; text: string } | null;
type Uebersicht = {
  konto: { email: string; name: string | null; firma: string | null };
  auftraege: { ref: string; titel: string; firma: string; gesellschaft: string | null; status: string; seit: string | null; url: string }[];
  angebote: { id: number; ref: string; titel: string; angenommenAm: string | null; vertragUrl: string | null }[];
};

const LEER6 = ["", "", "", "", "", ""];

function Schloss() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Sechs Felder, ein Code: Einfügen und Auto-Ausfüllen (iOS/Android) verteilen sich, Rücktaste springt zurück. */
function CodeFelder({ werte, setzen, fertig, falsch, aus, label, ziffer }: {
  werte: string[]; setzen: (w: string[]) => void; fertig: (code: string) => void; falsch: boolean; aus: boolean; label: string; ziffer: (n: number) => string;
}) {
  const felder = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { felder.current[0]?.focus(); }, []);
  const verteilen = (start: number, text: string) => {
    const ziffern = text.replace(/\D/g, "").slice(0, 6).split("");
    if (!ziffern.length) return;
    // Ein ganzer Code (Einfügen, Auto-Ausfüllen) gilt immer ab dem ersten Feld.
    const ab = ziffern.length === 6 ? 0 : start;
    const neu = [...werte];
    ziffern.slice(0, 6 - ab).forEach((z, i) => { neu[ab + i] = z; });
    setzen(neu);
    felder.current[Math.min(ab + ziffern.length, 5)]?.focus();
    if (neu.every(Boolean)) fertig(neu.join(""));
  };
  return (
    <div className={`gko-code${falsch ? " falsch" : ""}`} role="group" aria-label={label}>
      {werte.map((w, i) => (
        <input key={i} ref={(el) => { felder.current[i] = el; }} value={w} disabled={aus} className={w ? "voll" : ""}
          inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete={i === 0 ? "one-time-code" : "off"} aria-label={ziffer(i + 1)}
          onFocus={(e) => e.currentTarget.select()}
          onPaste={(e) => { e.preventDefault(); verteilen(i, e.clipboardData.getData("text")); }}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (!v) { const n = [...werte]; n[i] = ""; setzen(n); return; }
            verteilen(i, v.length > 1 && w ? v.replace(w, "") || v : v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !werte[i] && i > 0) { e.preventDefault(); const n = [...werte]; n[i - 1] = ""; setzen(n); felder.current[i - 1]?.focus(); }
            else if (e.key === "ArrowLeft" && i > 0) felder.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < 5) felder.current[i + 1]?.focus();
          }} />
      ))}
    </div>
  );
}

export default function BusinessKonto() {
  const [pfad] = useLocation();
  const sprache = useSprache();
  const s: "de" | "en" = sprache === "en" ? "en" : "de";
  const t = useWoerter(GLOBAL_KONTO_WOERTER);
  const P = KONTO_PFADE[s];
  const modus: Modus = /\/login\/?$/.test(pfad) ? "login" : /\/(passwort-vergessen|forgot-password)\/?$/.test(pfad) ? "vergessen" : /\/(zugang|access)\/?$/.test(pfad) ? "zugang" : "konto";

  // ── Alle Haken oben (AGENTS.md: nie hinter einem return) ────────────────
  const [schritt, setSchritt] = useState<"eingabe" | "code">("eingabe");
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [passwort2, setPasswort2] = useState("");
  const [zeigen, setZeigen] = useState(false);
  const [bleiben, setBleiben] = useState(true);
  const [falle, setFalle] = useState("");
  const [sendet, setSendet] = useState(false);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [vorgang, setVorgang] = useState("");
  const [maske, setMaske] = useState("");
  const [code, setCode] = useState<string[]>(LEER6);
  const [codeFalsch, setCodeFalsch] = useState(false);
  const [warten, setWarten] = useState(0);
  const [token, setToken] = useState("");
  const [link, setLink] = useState<{ stand: "laedt" | "ok" | "fehler" | "schon"; art?: "einladung" | "passwort"; email?: string; name?: string | null; firma?: string | null; text?: string }>({ stand: "laedt" });
  const [vergessenFertig, setVergessenFertig] = useState("");
  const [uebersicht, setUebersicht] = useState<Uebersicht | null>(null);
  const [kontoStand, setKontoStand] = useState<"laedt" | "ok" | "fehler">("laedt");
  const emailFeld = useRef<HTMLInputElement>(null);
  const passwortFeld = useRef<HTMLInputElement>(null);

  const api = async (weg: string, body?: Record<string, unknown>): Promise<{ status: number; j: any }> => {
    try {
      const r = await fetch(`/api/fiaon/global/konto/${weg}`, body === undefined
        ? { credentials: "same-origin" }
        : { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, sprache: s }) });
      return { status: r.status, j: await r.json().catch(() => ({})) };
    } catch { return { status: 0, j: { ok: false, error: t.technik } }; }
  };

  // Titel der Seite.
  useEffect(() => {
    document.title = modus === "konto" ? t.metaKonto : modus === "zugang" ? t.metaZugang : t.metaLogin;
  }, [modus, t]);

  // Anmeldung: Vorbelegung aus dem Portal übernehmen (und sofort vergessen).
  useEffect(() => {
    if (modus !== "login") return;
    try {
      const v = sessionStorage.getItem(VORBELEGUNG_SCHLUESSEL);
      if (v) { setEmail(v); sessionStorage.removeItem(VORBELEGUNG_SCHLUESSEL); setTimeout(() => passwortFeld.current?.focus(), 50); return; }
    } catch { /* ohne Speicher: leeres Feld */ }
    setTimeout(() => emailFeld.current?.focus(), 50);
  }, [modus]);

  // Zugang einrichten / neues Passwort: das Geheimnis aus dem Anker lesen, aus der Adresszeile nehmen, prüfen.
  useEffect(() => {
    if (modus !== "zugang") return;
    const m = window.location.hash.match(/^#([ep])=(.+)$/);
    const tok = m ? decodeURIComponent(m[2]) : "";
    try { window.history.replaceState(window.history.state, "", window.location.pathname); } catch { /* bleibt */ }
    if (!tok) { setLink({ stand: "fehler" }); return; }
    setToken(tok);
    void api("link", { token: tok }).then(({ j }) => {
      if (j?.ok) setLink({ stand: "ok", art: j.art, email: j.email, name: j.name, firma: j.firma });
      else if (j?.code === "schon_eingerichtet") setLink({ stand: "schon", email: j.email, text: t.schonEingerichtet });
      else setLink({ stand: "fehler", text: j?.error || t.technik });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modus]);

  // Übersicht „Ihre Aufträge“.
  useEffect(() => {
    if (modus !== "konto") return;
    void api("ich").then(({ status, j }) => {
      if (j?.ok) { setUebersicht(j); setKontoStand("ok"); }
      else if (status === 401) window.location.replace(`${P.login}?weiter=${encodeURIComponent(P.konto)}`);
      else setKontoStand("fehler");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modus]);

  // Countdown für „Code neu senden“.
  useEffect(() => {
    if (warten <= 0) return;
    const x = window.setTimeout(() => setWarten((w) => Math.max(0, w - 1)), 1000);
    return () => window.clearTimeout(x);
  }, [warten]);

  // ── Handlungen ──────────────────────────────────────────────────────────
  const zumCode = (j: any) => {
    setVorgang(String(j.vorgang)); setMaske(String(j.maske || "")); setCode(LEER6); setCodeFalsch(false); setWarten(60); setSchritt("code");
    setMeldung(j.mailFehler ? { art: "fehler", text: t.codeMailFehler } : null);
  };

  const anmelden = async (e: FormEvent) => {
    e.preventDefault();
    if (sendet) return;
    setSendet(true); setMeldung(null);
    const { j } = await api("anmelden", { email: email.trim(), passwort, bleiben });
    setSendet(false);
    if (j?.ok) { setPasswort(""); zumCode(j); } else setMeldung({ art: "fehler", text: j?.error || t.technik });
  };

  const codeSenden = async (wert?: string) => {
    const c = wert ?? code.join("");
    if (c.length !== 6 || sendet) return;
    setSendet(true); setMeldung(null); setCodeFalsch(false);
    const weiter = new URLSearchParams(window.location.search).get("weiter") || undefined;
    const { j } = await api("code", { vorgang, code: c, weiter });
    if (j?.ok && j.weiter) { window.location.assign(String(j.weiter)); return; }
    setSendet(false);
    setCodeFalsch(true); setCode(LEER6);
    setMeldung({ art: "fehler", text: j?.error || t.technik });
    // Verbraucht/abgelaufen ohne neuen Code: zurück an den Anfang dieser Seite.
    if (j?.code === "link") setLink({ stand: "fehler", text: j.error });
  };

  const codeNeu = async () => {
    if (warten > 0 || sendet) return;
    setMeldung(null);
    const { j } = await api("code-neu", { vorgang });
    if (j?.ok) { setWarten(60); setCode(LEER6); setCodeFalsch(false); setMeldung({ art: j.mailFehler ? "fehler" : "info", text: j.mailFehler ? t.codeMailFehler : j.meldung }); }
    else setMeldung({ art: "fehler", text: j?.error || t.technik });
  };

  const vergessen = async (e: FormEvent) => {
    e.preventDefault();
    if (sendet || !email.trim()) return;
    setSendet(true); setMeldung(null);
    const { j } = await api("passwort-vergessen", { email: email.trim(), falle });
    setSendet(false);
    if (j?.ok) setVergessenFertig(String(j.text)); else setMeldung({ art: "fehler", text: j?.error || t.technik });
  };

  const urteil = passwortBewerten(passwort, { email: link.email });
  const festlegen = async (e: FormEvent) => {
    e.preventDefault();
    if (sendet) return;
    setSendet(true); setMeldung(null);
    const { j } = await api("passwort-setzen", { token, passwort, wiederholung: passwort2, bleiben });
    setSendet(false);
    if (j?.ok) { setPasswort(""); setPasswort2(""); zumCode(j); } else setMeldung({ art: "fehler", text: j?.error || t.technik });
  };

  const abmelden = async () => {
    await api("abmelden", {});
    window.location.assign(P.login);
  };

  const zurAnmeldungMit = (adresse?: string) => {
    try { if (adresse) sessionStorage.setItem(VORBELEGUNG_SCHLUESSEL, adresse); } catch { /* egal */ }
    window.location.assign(P.login);
  };

  const loc = s === "en" ? "en-GB" : "de-DE";
  const tag = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }) : "";
  const pwFeld = (wert: string, setzen: (v: string) => void, beschriftung: string, auto: string, ref?: Ref<HTMLInputElement>, rechts?: ReactNode) => (
    <label className="gko-feld">
      <span>{beschriftung}{rechts}</span>
      <span className="gko-eingabe" style={{ display: "block" }}>
        <input ref={ref} type={zeigen ? "text" : "password"} autoComplete={auto} value={wert} onChange={(e) => setzen(e.target.value)} required />
        <button type="button" className="gko-zeigen" onClick={() => setZeigen((z) => !z)} aria-pressed={zeigen}>{zeigen ? t.verbergen : t.zeigen}</button>
      </span>
    </label>
  );
  const bleibenHaken = (
    <label className="gko-haken">
      <input type="checkbox" checked={bleiben} onChange={(e) => setBleiben(e.target.checked)} />
      <span><b>{t.bleiben}</b><small>{t.bleibenHinweis}</small></span>
    </label>
  );
  const meldungZeile = meldung && <p className={`gko-meldung ${meldung.art}`} role={meldung.art === "fehler" ? "alert" : "status"}>{meldung.text}</p>;

  const codeSchritt = (knopf: string) => (
    <>
      <span className="gko-auge">{t.auge}</span>
      <h1>{t.codeTitel}</h1>
      <p className="gko-lead">{t.codeLead(maske)}</p>
      <form className="gko-form" onSubmit={(e) => { e.preventDefault(); void codeSenden(); }} noValidate>
        <CodeFelder werte={code} setzen={(w) => { setCode(w); if (codeFalsch) setCodeFalsch(false); }} fertig={(c) => void codeSenden(c)} falsch={codeFalsch}
          aus={sendet} label={t.codeLabel} ziffer={t.codeZiffer} />
        {meldungZeile}
        <button type="submit" className="gko-knopf" disabled={sendet || code.some((c) => !c)}>{sendet ? t.einenMoment : knopf}</button>
        <div className="gko-code-neu">
          <button type="button" className="gko-textknopf" onClick={() => { setSchritt("eingabe"); setMeldung(null); }}>{t.andereAdresse}</button>
          <button type="button" className="gko-textknopf" onClick={() => void codeNeu()} disabled={warten > 0}>{warten > 0 ? t.codeNeuIn(warten) : t.codeNeu}</button>
        </div>
        <p className="gko-lead" style={{ margin: 0, fontSize: 13, color: "var(--leise)" }}>{t.codeHinweis}</p>
      </form>
    </>
  );

  // ── Inhalt je Adresse ───────────────────────────────────────────────────
  let inhalt: ReactNode = null;
  if (modus === "login") {
    inhalt = schritt === "code" ? codeSchritt(t.codeAnmelden) : (
      <>
        <span className="gko-auge">{t.auge}</span>
        <h1>{t.loginTitel}</h1>
        <p className="gko-lead">{t.loginLead}</p>
        <form className="gko-form" onSubmit={anmelden} noValidate data-fiaon="global-login">
          <label className="gko-feld">
            <span>{t.email}</span>
            <input ref={emailFeld} type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {pwFeld(passwort, setPasswort, t.passwort, "current-password", passwortFeld, <a href={P.vergessen}>{t.vergessenLink}</a>)}
          {bleibenHaken}
          {meldungZeile}
          <button type="submit" className="gko-knopf" disabled={sendet || !email.trim() || !passwort}>{sendet ? t.einenMoment : t.weiter}</button>
        </form>
        <div className="gko-fuss">
          <span>{t.ohneZugang}</span>
          <a href={`${P.auftrag}`}>{t.ohneZugangLink}</a>
        </div>
      </>
    );
  } else if (modus === "vergessen") {
    inhalt = (
      <>
        <span className="gko-auge">{t.auge}</span>
        <h1>{t.vergessenTitel}</h1>
        <p className="gko-lead">{t.vergessenLead}</p>
        {vergessenFertig ? (
          <div className="gko-form"><p className="gko-meldung gut" role="status">{vergessenFertig}</p><a className="gko-knopf leise" href={P.login}>{t.zurAnmeldung}</a></div>
        ) : (
          <form className="gko-form" onSubmit={vergessen} noValidate>
            <label className="gko-feld">
              <span>{t.email}</span>
              <input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={falle} onChange={(e) => setFalle(e.target.value)} style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
            {meldungZeile}
            <button type="submit" className="gko-knopf" disabled={sendet || !email.trim()}>{sendet ? t.einenMoment : t.vergessenKnopf}</button>
          </form>
        )}
        <div className="gko-fuss"><span /><a href={P.login}>{t.zurAnmeldung}</a></div>
      </>
    );
  } else if (modus === "zugang") {
    if (link.stand === "laedt") inhalt = <><span className="gko-auge">{t.auge}</span><h1>{t.einrichtenTitel}</h1><p className="gko-lead">{t.linkPruefen}</p></>;
    else if (link.stand === "fehler" || link.stand === "schon") inhalt = (
      <>
        <span className="gko-auge">{t.auge}</span>
        <h1>{link.stand === "schon" ? t.einrichtenTitel : t.neuTitel}</h1>
        <div className="gko-form">
          <p className={`gko-meldung ${link.stand === "schon" ? "info" : "fehler"}`} role="alert">{link.text || (s === "en" ? "This link is no longer valid." : "Dieser Link ist nicht mehr gültig.")}</p>
          <button type="button" className="gko-knopf" onClick={() => zurAnmeldungMit(link.email)}>{t.zurAnmeldung}</button>
          {link.stand !== "schon" && <a className="gko-knopf leise" href={P.vergessen}>{t.vergessenTitel}</a>}
        </div>
      </>
    );
    else if (schritt === "code") inhalt = codeSchritt(t.codeBestaetigen);
    else {
      const einladung = link.art === "einladung";
      const gleich = !!passwort2 && passwort2 === passwort;
      inhalt = (
        <>
          <span className="gko-auge">{t.auge}</span>
          <h1>{einladung ? t.einrichtenTitel : t.neuTitel}</h1>
          <p className="gko-lead">{einladung ? t.einrichtenLead : t.neuLead}</p>
          <div className="gko-wer">
            {(link.name || link.firma) && <div><span>{t.fuer}</span><b>{[link.name, link.firma].filter(Boolean).join(" · ")}</b></div>}
            <div><span>{t.anmeldung}</span><b>{link.email}</b></div>
          </div>
          <form className="gko-form" onSubmit={festlegen} noValidate data-fiaon="global-zugang">
            <input type="email" autoComplete="username" value={link.email || ""} readOnly hidden />
            {pwFeld(passwort, setPasswort, t.pwNeu, "new-password")}
            <div>
              <div className="gko-staerke" data-s={passwort ? urteil.staerke : 0} aria-hidden="true"><i /><i /><i /><i /></div>
              <p className="gko-staerke-text" style={{ margin: "6px 0 0" }}><span>{t.pwRegel}</span>{passwort && <b>{t.staerke[urteil.ok ? urteil.staerke : 0]}</b>}</p>
            </div>
            {pwFeld(passwort2, setPasswort2, t.pwWdh, "new-password", undefined, gleich ? <small style={{ color: "var(--gruen)", fontWeight: 500 }}>{t.pwGleich}</small> : null)}
            {bleibenHaken}
            {meldungZeile}
            <button type="submit" className="gko-knopf" disabled={sendet || !urteil.ok || !gleich}>{sendet ? t.einenMoment : t.festlegen}</button>
          </form>
        </>
      );
    }
  } else {
    const u = uebersicht;
    inhalt = (
      <>
        <span className="gko-auge">{t.auge}</span>
        {kontoStand === "laedt" && <h1>{t.kontoTitel}</h1>}
        {kontoStand === "fehler" && <><h1>{t.kontoTitel}</h1><p className="gko-meldung fehler" role="alert" style={{ marginTop: 18 }}>{t.technik}</p></>}
        {kontoStand === "ok" && u && (
          <>
            <p className="gko-lead" style={{ marginTop: 14, fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 19, color: "var(--blau)" }}>{t.kontoGruss(u.konto.name)}</p>
            <h1 style={{ marginTop: 6 }}>{t.kontoTitel}</h1>
            <p className="gko-lead">{t.kontoLead}</p>
            <div className="gko-liste" data-fiaon="global-konto-liste">
              {u.auftraege.map((a) => (
                <a key={a.ref} className="gko-zeile" href={a.url}>
                  <span>
                    <small>{t.status[a.status] ?? a.status}</small>
                    <b>{a.gesellschaft || a.titel}</b>
                    <em>{[a.gesellschaft ? a.titel : null, a.firma || null, a.seit ? t.seit(tag(a.seit)) : null].filter(Boolean).join(" · ")}</em>
                  </span>
                  <span className="gko-pfeil">{t.oeffnen} →</span>
                </a>
              ))}
              {u.angebote.map((a) => (
                <div key={a.id} className="gko-zeile">
                  <span>
                    <small>{a.ref}</small>
                    <b>{a.titel}</b>
                    <em>{a.angenommenAm ? t.angenommenAm(tag(a.angenommenAm)) : ""}</em>
                  </span>
                  {a.vertragUrl ? <a className="gko-pfeil" href={a.vertragUrl} target="_blank" rel="noopener">{t.vertragPdf}</a> : <span />}
                </div>
              ))}
              {u.auftraege.length === 0 && u.angebote.length === 0 && <p className="gko-meldung info">{t.kontoLeer}</p>}
            </div>
            <div className="gko-fuss">
              <span>{t.angemeldetAls(u.konto.email)}</span>
              <button type="button" className="gko-textknopf" onClick={() => void abmelden()}>{t.abmelden}</button>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="gko" lang={s}>
      <header className="gko-kopf">
        <a className="gko-logo" href={s === "en" ? "/en" : "/"} aria-label="FIAON Global"><FiaonWortmarke variante="global" hoehe="22px" /></a>
        <span className="gko-kopf-rechts"><a href={s === "en" ? "/en" : "/"}>fiaon.com</a></span>
      </header>
      <main className="gko-mitte">
        <section className={`gko-karte${modus === "konto" ? " breit" : ""}`} aria-live="polite">{inhalt}</section>
      </main>
      <p className="gko-sicher"><Schloss /> {t.sicher}</p>
    </div>
  );
}
