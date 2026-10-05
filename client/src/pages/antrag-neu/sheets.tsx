// Die Sheets des neuen Antrags (von unten einfahrende Tafeln): Vertrag,
// Leistungen, Angaben, Terminwahl, Auskunft, Passwort, QR-Code.
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { BANK_SATZ } from "@/components/antrag/bestelluebersicht-daten";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { ANTRAG_NEU_PAKETE, geburtText, staatAnzeige, type AntragNeuPaket, type AntragNeuSchritt } from "@shared/fiaon-antrag-neu";
import { AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT, auskunfteienText, auskunftLeistung } from "@shared/fiaon-auskunft";
import { BUENDEL_FAELLIG_SATZ, BUENDEL_SOFORT_OHNE, BUENDEL_SOFORT_TEXT, buendelHakenText, buendelPreisZeile, buendelTitel } from "@shared/fiaon-auskunft-buendel";
import { BERUF_TEXT, EINTRAG_TEXT, WOHNEN_TEXT } from "@shared/fiaon-antrag-neu";
import { Fehlerkasten, Haken, Pfeil, Tipp, Zeile, useAntrag } from "./bausteine";
import { api } from "./api";
import { anredeWort, anschriftText, einkommenText, euro, kartenName, mitWem, naechstesPaket, paket, telefonText, zweckText } from "./zustand";

// ── Der vollständige Vertrag (Text vom Server — derselbe, der bei der Annahme gespeichert wird) ──
export function VertragSheet({ fokus }: { fokus?: "widerruf" | "agb" }) {
  const { S, schliesseSheet } = useAntrag();
  const [html, setHtml] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [versuch, setVersuch] = useState(0);
  useEffect(() => {
    if (!S.ref) { setFehler("Ihr Antrag ist noch nicht gespeichert."); return; }
    let weg = false;
    void api.vertrag(S.ref, S.ag4).then((r) => {
      if (weg) return;
      if (r.ok && r.json?.html) setHtml(r.json.html);
      else setFehler("Der Vertrag konnte gerade nicht geladen werden.");
    });
    return () => { weg = true; };
  }, [S.ref, S.ag4, versuch]);
  useEffect(() => {
    if (!html || !fokus) return;
    const t = window.setTimeout(() => {
      const ziel = document.getElementById(fokus === "widerruf" ? "vt-widerruf" : "vt-agb");
      const sh = document.querySelector(".an-sheet");
      if (ziel && sh) sh.scrollTo({ top: ziel.offsetTop - 20, behavior: "smooth" });
    }, 380);
    return () => clearTimeout(t);
  }, [html, fokus]);
  return (
    <>
      <h2 id="an-sheetTitel" tabIndex={-1}>Ihr Vertrag</h2>
      {fehler ? <Fehlerkasten text={fehler} knopf="Noch einmal" onKnopf={() => { setFehler(null); setVersuch((v) => v + 1); }} /> : null}
      {!html && !fehler ? <p className="an-klein">Der Vertrag wird geladen …</p> : null}
      {html ? <div className="an-vertragstext" dangerouslySetInnerHTML={{ __html: html }} /> : null}
      <div className="an-knoepfe" style={{ marginTop: 14 }}>
        {S.angenommenAm && S.ref ? <a className="an-knopf an-leise" href={api.vertragPdf(S.ref)} target="_blank" rel="noopener">Als PDF öffnen</a> : null}
        <button type="button" className="an-knopf an-leise" onClick={schliesseSheet}>Schließen</button>
      </div>
    </>
  );
}

// ── Alles, was im Paket enthalten ist ──
export function LeistungSheet({ P }: { P: AntragNeuPaket }) {
  const { jetzt, schliesseSheet, deckGehe, paketWaehlen, toast, ereignis } = useAntrag();
  const N = naechstesPaket(P.key);
  return (
    <>
      <h2 id="an-sheetTitel" tabIndex={-1}>{P.name} · Ziel-Limit bis {euro(P.bis, false)}</h2>
      <p className="an-lead" style={{ margin: "0 0 12px", fontSize: ".875rem" }}>{P.intro}</p>
      <ol className="an-nummern">{P.leistungen.map((l) => <li key={l}><span>{l}</span></li>)}</ol>
      <p className="an-klein" style={{ marginTop: 12 }}>Monatsrate und alle Bedingungen sehen Sie vor dem Abschluss in Ihrem Vertrag. {BANK_SATZ}</p>
      {N ? (
        <button type="button" className="an-pitch" style={{ marginTop: 12 }} onClick={() => {
          schliesseSheet();
          ereignis("upgrade_angeboten", { schritt: jetzt, detail: N.key });
          if (jetzt === "paket") deckGehe(ANTRAG_NEU_PAKETE.findIndex((p) => p.key === N.key));
          else { paketWaehlen(N.key); toast(`Sie sind jetzt bei ${N.name}.`); }
        }}>
          <span>Oder lieber auf ein Ziel bis <b>{euro(N.bis, false)}</b> hinarbeiten – mit {N.name}?</span><Pfeil />
        </button>
      ) : null}
      <div className="an-knoepfe" style={{ marginTop: 12 }}><button type="button" className="an-knopf an-leise" onClick={schliesseSheet}>Schließen</button></div>
    </>
  );
}

// ── Ihre Angaben (mit „Ändern" je Zeile) ──
export function AngabenSheet() {
  const { S, setze, jetzt, gehe, schliesseSheet } = useAntrag();
  // Ohne schliesseSheet(): dessen history.back() liefe NACH dem pushState von gehe — Adresse und
  // Verlauf stünden dann auf dem alten Schritt. gehe schließt das Sheet selbst (ohne Rücksprung).
  const aendern = (ziel: AntragNeuSchritt) => {
    if (!S.angenommenAm && jetzt !== "pruefung") setze({ rueckZu: jetzt });
    gehe(ziel, { richtung: "zurueck" });
  };
  const gruppe = (titel: string, zeilen: [string, string, AntragNeuSchritt][]) => (
    <>
      <div className="an-gruppe">{titel}</div>
      {zeilen.map(([a, b, ziel]) => (
        <div className="an-angabe" key={a}>
          <span>{a}</span><b>{b || "–"}</b>
          {!S.angenommenAm ? <button type="button" className="an-aendern" onClick={() => aendern(ziel)}>Ändern</button> : null}
        </div>
      ))}
    </>
  );
  return (
    <>
      <h2 id="an-sheetTitel" tabIndex={-1}>Ihre Angaben</h2>
      <p className="an-klein">{S.angenommenAm ? "Ihr Vertrag ist geschlossen. Änderungen nehmen Sie in Ihrem Kundenbereich vor." : "Alles ist gespeichert. Tippen Sie auf „Ändern“, um etwas zu korrigieren."}</p>
      {gruppe("Ihre Person", [["Name", `${anredeWort(S)}${kartenName(S)}`, "name"], ["Geboren", geburtText(S), "geburt"], ["Staatsangehörigkeit", staatAnzeige(S), "adresse"]])}
      {gruppe("Kontakt", [["E-Mail", S.email, "kontakt"], ["Mobil", telefonText(S), "kontakt"]])}
      {gruppe("Anschrift", [["Anschrift", anschriftText(S), "adresse"]])}
      {gruppe("Beruf und Einkommen", [["Beruf", S.beruf ? BERUF_TEXT[S.beruf] : "", "beruf"], ["Einkommen", einkommenText(S), "einkommen"], ["Wohnen", S.wohnen ? WOHNEN_TEXT[S.wohnen] : "", "einkommen"], ["Einträge", S.eintraege ? EINTRAG_TEXT[S.eintraege] : "", "eintraege"]])}
      {S.geprueftAm ? gruppe("Ihr Ziel", [["Paket", paket(S.paket).name, "paket"], ["Start-Limit", euro(S.limit, false), "limit"], ["Nutzung", zweckText(S), "limit"]]) : null}
    </>
  );
}

// ── Termin wählen: Rückruf vor der Überweisung oder Startgespräch (echter Kalender) ──
type Slot = { beginn: string; datum: string; uhrzeit: string; agentId: number; agentVorname: string };
export function TerminWahl({ art, eingebettet = false }: { art: "vorher" | "start"; eingebettet?: boolean }) {
  const { S, setze, schliesseSheet, toast, ereignis } = useAntrag();
  const [token, setToken] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bucht, setBucht] = useState<string | null>(null);
  const [mehr, setMehr] = useState(false);
  const [versuch, setVersuch] = useState(0);
  const setzeTermin = (text: string, mit: string | null) => setze(art === "vorher" ? { rueckruf: { text, mit } } : { termin: { text, mit } });

  useEffect(() => {
    if (!S.ref) { setFehler("Bitte speichern Sie zuerst Ihre Angaben."); return; }
    let weg = false;
    (async () => {
      const l = await api.terminLink(S.ref!);
      const url = l.json?.url;
      const t = url ? url.split("/termin/")[1]?.split("?")[0] : null;
      if (!t) { if (!weg) setFehler(l.json?.error || "Der Kalender konnte gerade nicht geladen werden."); return; }
      const r = await api.terminSlots(t);
      if (weg) return;
      const j: any = r.json;
      if (!r.ok || !j) { setFehler(j?.hinweis || "Der Kalender konnte gerade nicht geladen werden."); return; }
      setToken(t);
      if (j.termin) { setzeTermin(`${j.termin.datumText}, ${j.termin.uhrzeit} Uhr`, j.termin.agentVorname ?? null); setSlots([]); return; }
      setSlots(Array.isArray(j.slots) ? j.slots : []);
    })();
    return () => { weg = true; };
  }, [S.ref, versuch]); // eslint-disable-line react-hooks/exhaustive-deps

  const tage = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots ?? []) { const l = m.get(s.datum) ?? []; l.push(s); m.set(s.datum, l); }
    return Array.from(m.entries()).slice(0, mehr ? 6 : 3);
  }, [slots, mehr]);

  const buchen = async (s: Slot) => {
    if (!token || bucht) return;
    setBucht(s.beginn); setFehler(null);
    const r = await api.terminBuchen(token, s.beginn, s.agentId);
    setBucht(null);
    const j: any = r.json;
    if (!r.ok || !j?.termin) { setFehler(j?.error || "Diese Zeit ist gerade vergeben. Bitte wählen Sie eine andere."); setVersuch((v) => v + 1); return; }
    const text = `${j.termin.datumText}, ${j.termin.uhrzeit} Uhr`;
    setzeTermin(text, j.termin.agentVorname ?? null);
    ereignis("termin_gebucht", { schritt: art === "vorher" ? "zahlung" : "danke", detail: art });
    if (!eingebettet) schliesseSheet();
    toast(art === "vorher" ? `Rückruf vorgemerkt: ${text}` : "Gespräch gebucht – die Bestätigung kommt per E-Mail.");
  };

  const tagName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });
  const vorhanden = art === "vorher" ? S.rueckruf : S.termin;
  const inhalt = (
    <>
      {fehler ? <Fehlerkasten text={fehler} knopf={!slots ? "Noch einmal" : undefined} onKnopf={() => { setFehler(null); setVersuch((v) => v + 1); }} /> : null}
      {vorhanden ? <div className="an-erledigt-zeile">{vorhanden.text}{mitWem(vorhanden.mit)}</div> : null}
      {!vorhanden && slots === null && !fehler ? <p className="an-klein">Freie Zeiten werden geladen …</p> : null}
      {!vorhanden && slots && slots.length === 0 && !fehler ? <p className="an-klein">Gerade ist keine Zeit frei. Wir melden uns innerhalb von 24 Stunden telefonisch bei Ihnen.</p> : null}
      {!vorhanden && tage.length ? (
        <div className="an-zeiten">
          {tage.map(([d, liste]) => (
            <div className="an-tag-zeile" key={d}>
              <span>{tagName(d)}</span>
              <div className="an-chips">
                {liste.slice(0, 8).map((s) => (
                  <button key={s.beginn} type="button" className={`an-chip${bucht === s.beginn ? " an-gewaehlt" : ""}`} disabled={!!bucht} onClick={() => void buchen(s)}>{s.uhrzeit}</button>
                ))}
              </div>
            </div>
          ))}
          {!mehr && (slots?.length ?? 0) > 0 && new Set(slots!.map((s) => s.datum)).size > 3 ? (
            <button type="button" className="an-knopf an-text" style={{ alignSelf: "flex-start" }} onClick={() => setMehr(true)}>Weitere Tage</button>
          ) : null}
        </div>
      ) : null}
    </>
  );
  if (eingebettet) return inhalt;
  return (
    <>
      <h2 id="an-sheetTitel" tabIndex={-1}>{art === "vorher" ? (S.angenommenAm ? "Fragen vor der Überweisung?" : "Fragen? Wir rufen Sie zurück.") : "Ihr Startgespräch"}</h2>
      <p className="an-lead" style={{ margin: "0 0 12px" }}>
        Wählen Sie eine Zeit, wir rufen Sie unter {telefonText(S) || "Ihrer Mobilnummer"} an. {S.angenommenAm ? "Ihr Vertrag und Ihre Zahlungsdaten bleiben gespeichert." : "Ihre Angaben bleiben gespeichert."}
      </p>
      {inhalt}
      <p className="an-klein" style={{ marginTop: 12 }}>Oder per E-Mail: {FIAON_FIRMA.email}</p>
    </>
  );
}

// ── Bonitätsauskunft zum Kundenpreis dazubestellen (Bündel, fällig nach der ersten Paketzahlung) ──
export function AuskunftSheet() {
  const { S, setze, schliesseSheet, toast, ereignis, sitzung } = useAntrag();
  const [fehlt, setFehlt] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const land = S.land;
  useEffect(() => { ereignis("auskunft_angesehen", { schritt: "danke" }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const bestellen = async () => {
    if (!S.ak1) { setFehlt(true); toast("Bitte bestätigen Sie die Bestellung mit dem ersten Haken."); return; }
    setLaedt(true); setFehler(null);
    const r = await api.auskunft(S.ref!, { gewaehlt: true, haken: buendelHakenText("privat"), auftrag: AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT("privat"), sofort: S.ak2, sitzung });
    setLaedt(false);
    if (!r.ok) { setFehler((r.json as any)?.error || "Die Bestellung kam gerade nicht an. Bitte versuchen Sie es noch einmal."); return; }
    setze({ auskunft: "bestellt" });
    schliesseSheet();
    toast("Bestellt – Zahlungsdaten erst nach Ihrer ersten Paketzahlung.");
  };
  return (
    <>
      <h2 id="an-sheetTitel" tabIndex={-1}>{buendelTitel("privat")}</h2>
      <p className="an-klein">{buendelPreisZeile("privat")}</p>
      <div className="an-gruppe">Bei diesen Auskunfteien</div>
      <p className="an-klein" style={{ margin: 0 }}>{auskunfteienText(land)}</p>
      <div className="an-gruppe">Das bekommen Sie</div>
      <ul className="an-punkte">{auskunftLeistung("privat", land).map((p) => <li key={p}>{p}</li>)}</ul>
      <div style={{ marginTop: 10 }}>
        <Haken an={S.ak1} fehlt={fehlt} onClick={() => { setze({ ak1: !S.ak1 }); setFehlt(false); }}>{buendelHakenText("privat")}</Haken>
        <Haken an={S.ak2} onClick={() => setze({ ak2: !S.ak2 })}>{BUENDEL_SOFORT_TEXT}</Haken>
      </div>
      <p className="an-klein" style={{ margin: "0 0 4px 36px" }}>Freiwillig. {BUENDEL_SOFORT_OHNE}</p>
      <div className="an-uebersicht" style={{ marginTop: 10 }}>
        <h3>Ihre Bestellung</h3>
        <Zeile a="Anbieter" b={FIAON_FIRMA.name} />
        <Zeile a="Leistung" b={`Datenkopien bei ${auskunfteienText(land)} anfordern und auswerten`} />
        <Zeile a="Preis" b="74 € einmalig, kein Abo" />
        <Zeile a="Fällig" b="nach Ihrer ersten Paketzahlung" />
      </div>
      <p className="an-klein" style={{ marginTop: 8 }}>
        {BUENDEL_FAELLIG_SATZ} <a href="/widerrufsbelehrung" target="_blank" rel="noopener" style={{ color: "var(--tief)" }}>Widerrufsbelehrung und Muster-Widerrufsformular lesen</a> – sie kommen außerdem mit der Bestätigung per E-Mail.
      </p>
      {fehler ? <Fehlerkasten text={fehler} /> : null}
      <div className="an-knoepfe" style={{ marginTop: 10 }}>
        <button type="button" className="an-knopf an-haupt" onClick={() => void bestellen()} disabled={laedt}>{laedt ? <span className="an-laden" aria-hidden="true" /> : null}Zahlungspflichtig bestellen</button>
        <button type="button" className="an-knopf an-text" style={{ alignSelf: "center" }} onClick={() => { ereignis("auskunft_abgelehnt", { schritt: "danke" }); schliesseSheet(); }}>Jetzt nicht</button>
      </div>
    </>
  );
}

// ── Passwort (freiwillig) ──
export function PasswortSheet() {
  const { S, setze, schliesseSheet, toast, ereignis } = useAntrag();
  const [pw, setPw] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const speichern = async () => {
    if (pw.length < 8) { setFehler("Bitte mindestens 8 Zeichen."); return; }
    setLaedt(true); setFehler(null);
    const ein = await api.einloggen(S.ref!);
    if (!ein.ok) { setLaedt(false); setFehler((ein.json as any)?.error || "Bitte melden Sie sich in Ihrem Kundenbereich an und legen Sie das Passwort dort fest."); return; }
    const r = await api.passwortSetzen(S.ref!, pw);
    setLaedt(false);
    if (!r.ok) { setFehler((r.json as any)?.error || "Das Passwort konnte gerade nicht gespeichert werden."); return; }
    setze({ passwort: true });
    ereignis("passwort_gesetzt", { schritt: "danke" });
    schliesseSheet();
    toast("Passwort gespeichert.");
  };
  return (
    <>
      <h2 id="an-sheetTitel" tabIndex={-1}>Passwort festlegen</h2>
      <p className="an-klein">Freiwillig. Sie können sich auch weiter über den Anmelde-Link per E-Mail anmelden.</p>
      <div className="an-feld" style={{ marginTop: 12 }}>
        <label htmlFor="an-pw1">Neues Passwort</label>
        <input className={`an-eingabe${fehler ? " an-fehlt" : ""}`} id="an-pw1" type="password" autoComplete="new-password" value={pw}
          onChange={(e) => { setPw(e.target.value); setFehler(null); }} onKeyDown={(e) => { if (e.key === "Enter") void speichern(); }} />
        {fehler ? <Tipp text={fehler} /> : <div className="an-klein" style={{ marginTop: 6 }}>Mindestens 8 Zeichen.</div>}
      </div>
      <div className="an-knoepfe" style={{ marginTop: 12 }}>
        <button type="button" className="an-knopf an-leise" onClick={() => void speichern()} disabled={laedt}>{laedt ? "Wird gespeichert …" : "Passwort speichern"}</button>
      </div>
    </>
  );
}

// ── QR-Code zum Speichern ──
export function QrSheet({ daten }: { daten: string }) {
  return (
    <>
      <h2 id="an-sheetTitel" tabIndex={-1}>Ihr Überweisungs-Code</h2>
      <div className="an-qr"><QRCodeSVG value={daten} size={220} level="M" includeMargin /></div>
      <p className="an-klein" style={{ textAlign: "center", marginTop: 8 }}>Bildschirmfoto machen und in der Banking-App unter „Foto-Überweisung“ oder „QR-Code“ öffnen.</p>
    </>
  );
}

