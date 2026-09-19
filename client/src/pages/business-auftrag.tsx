// ═══════════════════════════════════════════════════════════════════════════
// /business/auftrag/:ref — „MEIN AUFTRAG" BEI FIAON GLOBAL (17.09.2026, E-188)
//
// Justin: „Mach alles fix fertig, keine Platzhalter." Die Pakete nennen einen
// eigenen Dokumentenraum, einen Pflichtenkalender und einen festen Ansprech-
// partner. Diese Seite IST das: eine Akte je Auftrag, die das Unternehmen
// jederzeit öffnen kann — über den Link aus den Mails, ohne Konto, ohne
// Passwort. Wer den Link nicht mehr hat, fordert mit seiner E-Mail-Adresse
// einen neuen an.
//
//   GET  /api/fiaon/global/mein-auftrag/:ref?t=            alles auf einen Blick
//   POST …/dokument?t=   (FormData: datei, art)            Unterlage hochladen
//   GET  …/dokument/:id?t=                                 Dokument öffnen
//   POST …/nachricht?t=  { text }                          Nachricht an die zuständige Person
//   POST /api/fiaon/global/zugang { email }                neuen Link anfordern
//
// WAS HIER BEWUSST NICHT STEHT: kein Rahmen, kein Limit, keine Prognose. Die
// Seite zeigt, was getan ist und was als Nächstes kommt. Über Konto, Karte
// und Rahmen entscheidet das Institut — der Satz steht in der Seitenkarte.
// Gestaltung: dieselbe Welt wie der Auftrag (global-start.css), Glas nur an
// der Seitenkarte.
//
// 19.09.2026 (E-196): In der Seitenkarte unter „Ihr Auftrag" die Jahresbetreuung —
// gebucht: Titel, Zeile und Bedingungen aus shared/fiaon-global.ts; nicht gebucht:
// eine ruhige Zeile, dass der Ansprechpartner sie später dazunimmt. Keine eigene
// Buchungsstrecke — eine Nachricht an den Ansprechpartner genügt.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRoute } from "wouter";
import { Dunkel } from "@/components/site/DunkleBuehne";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { GLOBAL_AUFTRAG_WOERTER } from "@/i18n/global-auftrag";
import { GLOBAL_JAHRESBETREUUNG, globalPreisText } from "@shared/fiaon-global";
import "@/styles/global-start.css";
import "@/styles/global-auftrag.css";

type Etappe = { nr: number; titel: string; text?: string; stand: "fertig" | "jetzt" | "offen"; seit?: string };
type Dokument = { id: number | string; art: string; artText?: string; name: string; groesse?: number; von: "kunde" | "fiaon"; am?: string };
type Auftrag = {
  ref: string; status: string; paket: string; paketName: string;
  auftraggeber?: "unternehmen" | "privat";
  /** Nur Privatauftrag (E-191): Ende der Widerrufsfrist, Starttag ohne Wunsch nach sofortigem Beginn. */
  widerruf?: { fristEnde: string; startAb: string; sofortBeginn: boolean } | null;
  /** 19.09.2026 (E-196): Jahresbetreuung ab dem zweiten Jahr im Auftrag angekreuzt. */
  jahresbetreuung?: boolean;
  firma: { name: string; ort?: string; land?: string };
  zahlung?: { status: string; zahlungsseite?: string };
  etappe: number; etappen: Etappe[]; stichtag?: string | null;
  naechsterSchritt?: { text: string; bis?: string | null } | null;
  ansprechpartner?: { name: string; vorname?: string; email?: string; telefon?: string; bild?: string } | null;
  gesellschaft?: { name?: string; form?: string; bundesstaat?: string; gegruendetAm?: string } | null;
  unterlagen: { art: string; titel: string; hinweis?: string; vorhanden: boolean }[];
  dokumente: Dokument[];
  fristen: { id: number | string; titel: string; faelligAm: string; erledigt: boolean; hinweis?: string }[];
  verlauf: { am: string; text: string }[];
  vertragUrl?: string; rechnungUrl?: string;
};

const MAX_BYTES = 15 * 1024 * 1024;
const ERLAUBT = ".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic";

export default function BusinessAuftrag() {
  const t = useWoerter(GLOBAL_AUFTRAG_WOERTER);
  const sprache = useSprache();
  const s = sprache === "en" ? "en" : "de";
  const [, de] = useRoute("/business/auftrag/:ref?");
  const [, en] = useRoute("/en/business/auftrag/:ref?");
  const ref = (de?.ref || en?.ref || "").trim();
  const token = new URLSearchParams(window.location.search).get("t") || "";

  const [auftrag, setAuftrag] = useState<Auftrag | null>(null);
  const [stand, setStand] = useState<"laedt" | "da" | "zugang">(ref && token ? "laedt" : "zugang");
  const basis = `/api/fiaon/global/mein-auftrag/${encodeURIComponent(ref)}`;
  const mitToken = (pfad: string) => `${basis}${pfad}?t=${encodeURIComponent(token)}`;

  const laden = useCallback(async () => {
    if (!ref || !token) return;
    try {
      const r = await fetch(mitToken(""));
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok && j.auftrag) { setAuftrag(j.auftrag); setStand("da"); } else setStand("zugang");
    } catch { setStand("zugang"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, token]);
  useEffect(() => { laden(); }, [laden]);

  const loc = s === "en" ? "en-GB" : "de-DE";
  const tag = (iso?: string | null) => iso ? new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" }) : "";
  const tagKurz = (iso?: string | null) => iso ? new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  const kb = (n?: number) => !n ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString(loc, { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

  // ── Hochladen ───────────────────────────────────────────────────────────
  const dateiFeld = useRef<HTMLInputElement>(null);
  const [zielArt, setZielArt] = useState("sonstiges");
  const [laedtHoch, setLaedtHoch] = useState("");
  const [uploadMeldung, setUploadMeldung] = useState("");
  const darfHochladen = auftrag ? ["bezahlt", "gestartet", "abgeschlossen"].includes(auftrag.status) : false;
  const waehleDatei = (art: string) => { setZielArt(art); setUploadMeldung(""); dateiFeld.current?.click(); };
  const hochladen = async (datei: File | undefined) => {
    if (!datei) return;
    if (datei.size > MAX_BYTES) { setUploadMeldung(t.uploadZuGross); return; }
    setLaedtHoch(zielArt); setUploadMeldung("");
    try {
      const fd = new FormData(); fd.append("art", zielArt); fd.append("datei", datei);
      const r = await fetch(mitToken("/dokument"), { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) setUploadMeldung(j.error || t.uploadFehler); else await laden();
    } catch { setUploadMeldung(t.uploadFehler); }
    finally { setLaedtHoch(""); if (dateiFeld.current) dateiFeld.current.value = ""; }
  };

  // ── Nachricht ───────────────────────────────────────────────────────────
  const [text, setText] = useState("");
  const [sendet, setSendet] = useState(false);
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const senden = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSendet(true); setMeldung(null);
    try {
      const r = await fetch(mitToken("/nachricht"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim() }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setText(""); setMeldung({ gut: true, text: t.nachrichtOk }); laden(); } else setMeldung({ gut: false, text: j.error || t.nachrichtFehler });
    } catch { setMeldung({ gut: false, text: t.nachrichtFehler }); }
    finally { setSendet(false); }
  };

  // ── Zugang neu anfordern ────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [falle, setFalle] = useState("");
  const [zugangStand, setZugangStand] = useState<"" | "sendet" | "ok">("");
  const zugang = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setZugangStand("sendet");
    try { await fetch("/api/fiaon/global/zugang", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), falle }) }); } catch { /* die Antwort ist immer dieselbe */ }
    setZugangStand("ok");
  };

  const a = auftrag;
  const titel = stand === "da" && a ? a.firma.name : t.zugangTitel;
  const J = GLOBAL_JAHRESBETREUUNG[s];

  return (
    <Dunkel seite="business" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <div className="gs">
        <div className="dk-rahmen">
          <header className="gs-kopf">
            <span className="gs-auge">{t.pille}</span>
            <h1 className="gs-h1">{stand === "laedt" ? t.laedt : titel}</h1>
            {stand === "da" && a && <p className="gs-lead">FIAON {a.paketName.replace(/^FIAON\s+/, "")} · {t.status[a.status] || a.status}</p>}
          </header>

          {stand === "zugang" && (
            <div className="gs-rahmen" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
              <div className="gs-blatt ga-zugang">
                <h2>{t.zugangTitel}</h2>
                <p className="lead">{ref && token ? t.zugangAbgelaufen : t.zugangOhne}</p>
                {zugangStand === "ok" ? <p className="gs-gut" role="status">{t.zugangOk}</p> : (
                  <form onSubmit={zugang} className="gs-felder" noValidate>
                    <label><span className="gs-label">{t.zugangEmail}</span><input className="gs-feld" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                    <input className="gs-falle" tabIndex={-1} autoComplete="off" aria-hidden="true" value={falle} onChange={(e) => setFalle(e.target.value)} />
                    <button type="submit" className="gs-knopf" disabled={zugangStand === "sendet" || !email.trim()}>{zugangStand === "sendet" ? t.zugangSendet : t.zugangKnopf}</button>
                  </form>
                )}
                <div className="gs-fuss"><a className="gs-zurueck" href={inSprache("/business", sprache)}>{t.zurSeite}</a><span /></div>
              </div>
            </div>
          )}

          {stand === "da" && a && (
            <div className="gs-rahmen">
              <div className="gs-blatt">
                <input ref={dateiFeld} className="ga-datei" type="file" accept={ERLAUBT} onChange={(e) => hochladen(e.target.files?.[0])} aria-hidden="true" tabIndex={-1} />

                {a.status === "offen" && (
                  <div className="ga-zahlung">
                    <h3>{t.zahlungOffenTitel}</h3>
                    <p>{t.zahlungOffenText}</p>
                    {a.zahlung?.zahlungsseite && <a className="gs-knopf" href={a.zahlung.zahlungsseite}>{t.zurZahlung}</a>}
                  </div>
                )}

                <section className="ga-abschnitt">
                  <h2>{t.wegTitel}</h2>
                  <ol className="ga-weg">
                    {a.etappen.map((e) => (
                      <li key={e.nr} data-stand={e.stand} aria-current={e.stand === "jetzt" ? "step" : undefined}>
                        <b>{e.titel}<small>{t.etappeStand[e.stand]}{e.stand === "jetzt" && e.seit ? ` · ${t.seit(tagKurz(e.seit))}` : ""}</small></b>
                        {e.text && <p>{e.text}</p>}
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="ga-abschnitt">
                  <h2>{t.schrittTitel}</h2>
                  {a.naechsterSchritt?.text
                    ? <div className="ga-schritt"><p>{a.naechsterSchritt.text}</p>{a.naechsterSchritt.bis && <small>{t.schrittBis(tag(a.naechsterSchritt.bis))}</small>}</div>
                    : <p className="ga-leer">{t.schrittLeer}</p>}
                  {a.stichtag && <p className="ga-stichtag">{t.stichtag}: <b>{tag(a.stichtag)}</b></p>}
                  {a.widerruf && (
                    <p className="ga-stichtag">
                      {t.widerrufBis}: <b>{tag(a.widerruf.fristEnde)}</b>
                      {!a.widerruf.sofortBeginn && (a.status === "offen" || a.status === "bezahlt") && <><br />{t.startNachFrist(tag(a.widerruf.startAb))}</>}
                    </p>
                  )}
                </section>

                <section className="ga-abschnitt">
                  <h2>{t.unterlagenTitel}</h2>
                  <p className="lead">{darfHochladen ? t.unterlagenLead : t.uploadGesperrt}</p>
                  <ul className="ga-liste">
                    {a.unterlagen.map((u) => (
                      <li key={u.art}>
                        <div><b>{u.titel}</b>{u.hinweis && <span>{u.hinweis}</span>}</div>
                        <div className="ga-rechts">
                          <span className={`ga-marke ${u.vorhanden ? "gut" : "offen"}`}>{u.vorhanden ? t.vorhanden : t.fehlt}</span>
                          <button type="button" className={`ga-knopf${u.vorhanden ? "" : " blau"}`} disabled={!darfHochladen || !!laedtHoch} onClick={() => waehleDatei(u.art)}>{laedtHoch === u.art ? t.laedtHoch : t.hochladen}</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {uploadMeldung && <p className="ga-meldung schlecht" role="alert">{uploadMeldung}</p>}
                </section>

                <section className="ga-abschnitt">
                  <h2>{t.raumTitel}</h2>
                  <p className="lead">{t.raumLead}</p>
                  <ul className="ga-liste">
                    {a.vertragUrl && <li><div><b>{t.vertragPdf}</b><span>{t.vonFiaon}</span></div><div className="ga-rechts"><a className="ga-knopf" href={a.vertragUrl} target="_blank" rel="noopener">{t.oeffnen}</a></div></li>}
                    {a.rechnungUrl && <li><div><b>{t.rechnungPdf}</b><span>{t.vonFiaon}</span></div><div className="ga-rechts"><a className="ga-knopf" href={a.rechnungUrl} target="_blank" rel="noopener">{t.oeffnen}</a></div></li>}
                    {a.dokumente.map((d) => (
                      <li key={d.id}>
                        <div><b>{d.artText || d.name}</b><span>{[d.artText ? d.name : "", d.von === "kunde" ? t.vonIhnen : t.vonFiaon, tagKurz(d.am), kb(d.groesse)].filter(Boolean).join(" · ")}</span></div>
                        <div className="ga-rechts"><a className="ga-knopf" href={mitToken(`/dokument/${encodeURIComponent(String(d.id))}`)} target="_blank" rel="noopener">{t.oeffnen}</a></div>
                      </li>
                    ))}
                  </ul>
                  <div className="ga-fuss"><button type="button" className="ga-knopf" disabled={!darfHochladen || !!laedtHoch} onClick={() => waehleDatei("sonstiges")}>{laedtHoch === "sonstiges" ? t.laedtHoch : t.weitereDatei}</button></div>
                </section>

                <section className="ga-abschnitt">
                  <h2>{t.fristenTitel}</h2>
                  <p className="lead">{t.fristenLead}</p>
                  {a.fristen.length === 0 ? <p className="ga-leer">{t.fristenLeer}</p> : (
                    <ul className="ga-liste">
                      {a.fristen.map((f) => (
                        <li key={f.id} data-erledigt={f.erledigt ? "1" : undefined}>
                          <div><b>{f.titel}</b>{f.hinweis && <span>{f.hinweis}</span>}</div>
                          <div className="ga-rechts">{f.erledigt && <span className="ga-marke gut">{t.erledigt}</span>}<span className="ga-frist-datum">{tagKurz(f.faelligAm)}</span></div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="ga-abschnitt">
                  <h2>{t.verlaufTitel}</h2>
                  {a.verlauf.length === 0 ? <p className="ga-leer">{t.verlaufLeer}</p> : (
                    <ol className="ga-verlauf">{a.verlauf.map((v, i) => <li key={i}><time dateTime={v.am}>{tagKurz(v.am)}</time><span>{v.text}</span></li>)}</ol>
                  )}
                </section>

                <section className="ga-abschnitt ga-nachricht">
                  <h2>{t.nachrichtTitel}</h2>
                  <form onSubmit={senden}>
                    <textarea value={text} maxLength={2000} placeholder={t.nachrichtPlatz} onChange={(e) => setText(e.target.value)} aria-label={t.nachrichtTitel} />
                    {meldung && <p className={`ga-meldung ${meldung.gut ? "gut" : "schlecht"}`} role="status">{meldung.text}</p>}
                    <div className="ga-fuss"><button type="submit" className="ga-knopf blau" disabled={sendet || !text.trim()}>{sendet ? t.nachrichtSendet : t.nachrichtSenden}</button></div>
                  </form>
                </section>
              </div>

              <aside className="gs-seite ga-seite" aria-label={t.seiteAnsprech}>
                <h2>{t.seiteAnsprech}</h2>
                {a.ansprechpartner ? (
                  <div className="ga-person">
                    {a.ansprechpartner.bild ? <img src={a.ansprechpartner.bild} alt="" /> : <span className="mono" aria-hidden="true">{(a.ansprechpartner.vorname || a.ansprechpartner.name || "F").slice(0, 1)}</span>}
                    <div>
                      <b>{a.ansprechpartner.name}</b>
                      {a.ansprechpartner.email && <a className="ga-kontakt" href={`mailto:${a.ansprechpartner.email}`}>{a.ansprechpartner.email}</a>}
                      {a.ansprechpartner.telefon && <a className="ga-kontakt" href={`tel:${a.ansprechpartner.telefon.replace(/\s/g, "")}`}>{a.ansprechpartner.telefon}</a>}
                    </div>
                  </div>
                ) : <p className="klein" style={{ marginTop: 12 }}>{t.seiteAnsprechLeer}</p>}

                <h2 style={{ marginTop: 26 }}>{t.seiteAuftrag}</h2>
                <p className="name">{a.paketName}</p>
                <p className="preis" style={{ fontSize: 24 }}>{globalPreisText(a.paket, s)}</p>
                <div className="ga-zeilen">
                  <div><span>{t.seiteReferenz}</span><b>{a.ref}</b></div>
                </div>
                {/* E-196: Jahresbetreuung — gebucht mit Bedingungen, sonst die ruhige Zeile (keine Buchungsstrecke). */}
                {a.jahresbetreuung ? (
                  <div className="ga-jahr">
                    <h2>{J.titel}</h2>
                    <p className="ga-jahr-zeile">{J.gebucht}</p>
                    <p className="klein">{J.bedingungen}</p>
                  </div>
                ) : a.status !== "storniert" && <p className="klein">{t.jahrSpaeter(J.titel, J.preisZeile)}</p>}

                {a.gesellschaft && (a.gesellschaft.name || a.gesellschaft.bundesstaat) && (
                  <>
                    <h2 style={{ marginTop: 26 }}>{t.seiteGesellschaft}</h2>
                    <div className="ga-zeilen">
                      {a.gesellschaft.name && <div><b>{a.gesellschaft.name}{a.gesellschaft.form ? ` · ${a.gesellschaft.form}` : ""}</b></div>}
                      {a.gesellschaft.bundesstaat && <div><b>{a.gesellschaft.bundesstaat}{a.gesellschaft.gegruendetAm ? ` · ${tagKurz(a.gesellschaft.gegruendetAm)}` : ""}</b></div>}
                    </div>
                  </>
                )}
                <p className="klein">{t.seiteHinweis}</p>
              </aside>
            </div>
          )}
        </div>
      </div>
    </Dunkel>
  );
}
