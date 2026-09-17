// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO · GLOBAL-AUFTRÄGE — die Liste für die Leitung (17.09.2026, E-188)
//
// Justin: „Direktkauf: Vertrag, Rechnung, Zahlung aufs Bankkonto = Start."
// Ein Unternehmen unterschreibt auf /business/start und überweist 2.499 bis
// 35.999 €. Diese Seite zeigt jeden dieser Aufträge mit dem, was die Leitung
// wissen und tun muss:
//   · Wo steht er? offen → bezahlt → gestartet (oder storniert). „Bezahlt, nicht
//     gestartet" heißt: Die Aufgabe oder die Startmail hing — ein Knopf stößt
//     den Start noch einmal an (er ist wiederholbar, nichts passiert doppelt).
//   · Wer ist zuständig — und wer soll es sein („Zuständig ändern": Aufgabe und
//     Betreuung wandern mit).
//   · Der STICHTAG für Gesellschaft und EIN. An ihm hängt die Geld-zurück-Zusage
//     aus Ziffer 6 des Auftrags; er wird im Startgespräch vereinbart, hier
//     eingetragen und dem Kunden von hier in Textform mitgeteilt.
//   · Vertrag und Rechnung als PDF — dieselben Dateien, die der Kunde hat.
//   · Ob und wann der ruhige Zahlungstakt erinnert hat (Tag 3 und 7 per Mail, Tag 10
//     als Aufgabe „anrufen" an die zuständige Person) — server/lib/fiaon-global-zahlungstakt.ts.
//   · „Auftrag stornieren": Grund ist Pflicht (bezahlt: ein ganzer Satz). „Mit
//     Erstattung" bewegt KEIN Geld — es entsteht eine dringende Aufgabe für Justin,
//     der von Hand überweist. Regeln: server/lib/fiaon-global-storno.ts.
// Geld wird hier nicht gebucht: Der Zahlungseingang läuft über den einen Weg
// (Zahlungen verbuchen), und mit ihm startet der Auftrag von selbst.
//
// Die drei Einstellungen dazu (zuständige Person, Provisionssatz, USt-Modus)
// stehen bei den Schaltern im Raum Rückholung. Server: routes/fiaon-global.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { eur, datum, Geruest, Fehlermeldung, useDaten, API } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-zahlen.css";
import "@/styles/chef-mailwerk.css";
import "@/styles/chef-global.css";

type Status = "offen" | "bezahlt" | "gestartet" | "storniert";
type Filter = "laufend" | "offen" | "bezahlt" | "gestartet" | "alle";

interface Zeile {
  ref: string; status: Status; ohneAuftrag: boolean;
  firma: string; ort: string; land: string | null;
  ansprechpartner: string; funktion: string | null; email: string | null; telefon: string | null;
  paket: string; paketName: string; betragCents: number; katalogCents: number | null;
  erstelltAm: string; alterTage: number; unterschriebenAm: string | null; zahlungGemeldetAm: string | null;
  bezahltAm: string | null; gestartetAm: string | null; faelligAm: string | null;
  verwendungszweck: string | null; rechnungsnummer: string | null; ustModus: string; ustHinweis: string | null;
  zustaendig: { id: number; name: string } | null; betreuer: string | null;
  stichtag: string | null; stichtagMailAm: string | null;
  auftragMailAm: string | null; auftragMailFehler: string | null; startMailAm: string | null; startMailFehler: string | null;
  sprache: string | null; quelle: string | null;
  erinnerung1Am: string | null; erinnerung2Am: string | null; anrufAufgabeAm: string | null; taktHinweis: string | null;
  storniertAm: string | null; storniertVon: string | null; stornoGrund: string | null; stornoErstattung: boolean;
  vertragUrl: string | null; rechnungUrl: string | null; zahlungsseite: string | null;
}
interface Antwort {
  ok: boolean; zeilen: Zeile[];
  mitarbeiter: { id: number; name: string; rolle: string }[];
  einstellungen: { zustaendigAgentId: number | null; provisionProzent: number; ustModus: string };
}

const STATUS_TEXT: Record<Status, string> = { offen: "Offen — wartet auf Zahlung", bezahlt: "Bezahlt — nicht gestartet", gestartet: "Gestartet", storniert: "Storniert" };

export default function ChefGlobalAuftraege() {
  const { daten, fehler, neu } = useDaten<Antwort>("/admin/global/auftraege");
  const [filter, setFilter] = useState<Filter>("laufend");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [offen, setOffen] = useState<{ ref: string; art: "stichtag" | "zustaendig" | "storno" } | null>(null);
  const [wert, setWert] = useState("");
  const [mitteilen, setMitteilen] = useState(true);
  const [erstattung, setErstattung] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const senden = async (ref: string, pfad: string, body: Record<string, unknown>) => {
    setBusy(`${ref}:${pfad}`); setMeldung(null);
    const r = await fetch(`${API}/admin/global/auftraege/${encodeURIComponent(ref)}/${pfad}`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then((x) => x.json()).catch(() => ({ ok: false, error: "Keine Verbindung zum Server." }));
    setBusy(null);
    setMeldung(r.ok ? (r.meldung || "Gespeichert.") : `Nicht gespeichert: ${r.error}`);
    if (r.ok) { setOffen(null); setWert(""); neu(); }
  };

  if (fehler) return <Fehlermeldung text={fehler} erneut={neu} />;
  if (!daten) return <Geruest zeilen={6} />;

  const alle = daten.zeilen;
  const zaehler = {
    offen: alle.filter((z) => z.status === "offen").length,
    bezahlt: alle.filter((z) => z.status === "bezahlt").length,
    gestartet: alle.filter((z) => z.status === "gestartet").length,
    ohneStichtag: alle.filter((z) => z.status === "gestartet" && !z.stichtag).length,
  };
  const offenerWert = alle.filter((z) => z.status === "offen").reduce((s, z) => s + z.betragCents, 0);
  const sichtbar = alle.filter((z) =>
    filter === "alle" ? true : filter === "laufend" ? z.status !== "storniert" : z.status === filter);
  const zustaendigName = daten.mitarbeiter.find((m) => m.id === daten.einstellungen.zustaendigAgentId)?.name;

  return (
    <div className="cg" data-fiaon="global-auftraege">
      <Rundgang raum="global-auftraege" titel="Global-Aufträge" schritte={RUNDGAENGE.globalAuftraege.schritte} />
      {meldung && <div className="cm-meldung" role="status">{meldung}</div>}

      <section className="cz-block cg-kopf">
        <header>
          <h2>FIAON Global — die Aufträge</h2>
          <p>Jeder Auftrag, den ein Unternehmen auf /business/start unterschrieben hat. Mit dem Zahlungseingang startet er von selbst: Aufgabe „US-Struktur starten“ an die zuständige Person, danach die Startmail an den Kunden.</p>
        </header>
        <div className="cg-zahlen">
          <div><b>{zaehler.offen}</b><span>offen — {eur(offenerWert)} warten auf Zahlung</span></div>
          <div className={zaehler.bezahlt ? "cg-warn" : ""}><b>{zaehler.bezahlt}</b><span>bezahlt, nicht gestartet — hier hängt etwas</span></div>
          <div><b>{zaehler.gestartet}</b><span>gestartet</span></div>
          <div className={zaehler.ohneStichtag ? "cg-warn" : ""}><b>{zaehler.ohneStichtag}</b><span>gestartet ohne Stichtag — im Startgespräch festlegen</span></div>
        </div>
        <p className="cm-fein cg-einstellungen">
          Neue Aufträge gehen an <b>{zustaendigName ?? "die Vertriebsleitung"}</b> · Provision {daten.einstellungen.provisionProzent} % · Rechnung: {daten.einstellungen.ustModus === "reverse_charge" ? "Reverse Charge" : "ohne Steuerausweis"} — ändern unter <a href="/chef/rueckholung">Rückholung → FIAON Global</a>.
        </p>
      </section>

      <section className="cz-block">
        <div className="cg-filter" role="tablist">
          {([["laufend", "Laufend"], ["offen", "Offen"], ["bezahlt", "Bezahlt, nicht gestartet"], ["gestartet", "Gestartet"], ["alle", "Alle"]] as [Filter, string][]).map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? "aktiv" : ""} onClick={() => setFilter(k)}>{t}</button>
          ))}
        </div>

        {sichtbar.length === 0 ? (
          <p className="cg-leer">{alle.length === 0 ? "Noch kein Global-Auftrag. Der erste erscheint hier, sobald ein Unternehmen auf /business/start unterschrieben hat." : "In dieser Ansicht liegt gerade nichts."}</p>
        ) : (
          <div className="cm-tab-halter"><table className="cm-tab cg-tab">
            <thead><tr><th>Firma</th><th>Paket</th><th>Stand</th><th>Zuständig</th><th>Stichtag</th><th>Dokumente</th><th></th></tr></thead>
            <tbody>
              {sichtbar.map((z) => (
                <tr key={z.ref} className={`cg-zeile cg-${z.status}`}>
                  <td>
                    <b>{z.firma}</b>
                    <span className="cm-klartext">{[z.ort, z.land].filter(Boolean).join(", ")}{z.ansprechpartner ? ` · ${z.ansprechpartner}${z.funktion ? `, ${z.funktion}` : ""}` : ""}</span>
                    <span className="cm-klartext">{[z.email, z.telefon].filter(Boolean).join(" · ") || "—"}</span>
                    <span className="cm-klartext cg-ref">{z.ref}{z.verwendungszweck ? ` · Verwendungszweck ${z.verwendungszweck}` : ""}</span>
                  </td>
                  <td>
                    <b>{z.paketName.replace(/^FIAON /, "")}</b>
                    <span className={`cm-klartext cm-zahl ${z.katalogCents != null && z.katalogCents !== z.betragCents ? "rot" : ""}`}>{eur(z.betragCents)} einmalig</span>
                    {z.katalogCents != null && z.katalogCents !== z.betragCents && <span className="cm-klartext cg-rot">Katalog sagt {eur(z.katalogCents)} — vor der Buchung klären.</span>}
                    {z.ustHinweis && <span className="cm-klartext cg-rot">USt-IdNr. fehlt — Rechnung ohne Steuerausweis.</span>}
                  </td>
                  <td>
                    <span className={`cg-marke cg-marke-${z.status}`}>{STATUS_TEXT[z.status]}</span>
                    <span className="cm-klartext">
                      {z.status === "offen" && <>seit {z.alterTage === 0 ? "heute" : `${z.alterTage} ${z.alterTage === 1 ? "Tag" : "Tagen"}`}{z.faelligAm ? ` · zahlbar bis ${datum(z.faelligAm)}` : ""}{z.zahlungGemeldetAm ? ` · Kunde meldet Überweisung am ${datum(z.zahlungGemeldetAm)}` : ""}</>}
                      {z.status === "bezahlt" && <>bezahlt am {datum(z.bezahltAm)} — Aufgabe oder Startmail fehlt</>}
                      {z.status === "gestartet" && <>bezahlt am {datum(z.bezahltAm)} · gestartet am {datum(z.gestartetAm)}</>}
                      {z.status === "storniert" && <>angelegt am {datum(z.erstelltAm)}{z.storniertAm ? ` · storniert am ${datum(z.storniertAm)}${z.storniertVon ? ` von ${z.storniertVon}` : ""}` : ""}</>}
                    </span>
                    {z.status === "storniert" && z.stornoGrund && <span className="cm-klartext">Grund: {z.stornoGrund}{z.stornoErstattung ? " · Erstattung liegt als Aufgabe bei Justin" : z.bezahltAm ? " · ohne Erstattung" : ""}</span>}
                    {z.status === "offen" && (z.erinnerung1Am || z.erinnerung2Am || z.anrufAufgabeAm) && (
                      <span className="cm-klartext">
                        {[z.erinnerung1Am ? `Erinnerung 1 am ${datum(z.erinnerung1Am)}` : null, z.erinnerung2Am ? `Erinnerung 2 am ${datum(z.erinnerung2Am)}` : null, z.anrufAufgabeAm ? `Aufgabe „anrufen“ am ${datum(z.anrufAufgabeAm)}` : null].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {z.status === "offen" && z.taktHinweis && <span className="cm-klartext cg-rot">Zahlungstakt: {z.taktHinweis}</span>}
                    {z.ohneAuftrag && <span className="cm-klartext cg-rot">Kein unterschriebener Auftrag — nicht über /business/start angelegt.</span>}
                    {z.auftragMailFehler && !z.auftragMailAm && <span className="cm-klartext cg-rot">Vertrag und Rechnung gingen nicht raus: {z.auftragMailFehler}</span>}
                    {z.startMailFehler && !z.startMailAm && <span className="cm-klartext cg-rot">Startmail ging nicht raus: {z.startMailFehler}</span>}
                  </td>
                  <td>
                    {z.zustaendig ? <b>{z.zustaendig.name}</b> : <span className="cg-rot">niemand</span>}
                    {z.betreuer && z.betreuer !== z.zustaendig?.name && <span className="cm-klartext">Betreuer der Person: {z.betreuer}</span>}
                  </td>
                  <td>
                    {z.stichtag ? <b>{datum(z.stichtag)}</b> : <span className="cm-wann">{z.status === "gestartet" ? "fehlt" : "—"}</span>}
                    {z.stichtag && <span className="cm-klartext">{z.stichtagMailAm ? `dem Kunden mitgeteilt am ${datum(z.stichtagMailAm)}` : "dem Kunden noch nicht mitgeteilt"}</span>}
                  </td>
                  <td>
                    <div className="cg-links">
                      {z.vertragUrl ? <a href={z.vertragUrl} target="_blank" rel="noreferrer">Vertrag (PDF)</a> : <span className="cm-wann">kein Vertrag</span>}
                      {z.rechnungUrl && <a href={z.rechnungUrl} target="_blank" rel="noreferrer">Rechnung{z.rechnungsnummer ? ` ${z.rechnungsnummer.replace(/^FIAON-INV-/, "")}` : ""} (PDF)</a>}
                      {z.zahlungsseite && z.status === "offen" && <a href={z.zahlungsseite} target="_blank" rel="noreferrer">Zahlungsseite des Kunden</a>}
                    </div>
                  </td>
                  <td>
                    <div className="cg-knoepfe">
                      {/* Der Grund steht als TEXT da, nicht im Tooltip (AGENTS.md: ein gesperrter Knopf ohne sichtbaren Grund ist ein Rätsel). */}
                      {!z.ohneAuftrag && z.status === "offen" && <span className="cm-klartext">Stichtag: erst nach dem Zahlungseingang — er wird im Startgespräch festgelegt.</span>}
                      {!z.ohneAuftrag && (z.status === "bezahlt" || z.status === "gestartet") && (
                        <button type="button" className="cg-knopf cg-knopf-stichtag"
                          onClick={() => { setOffen({ ref: z.ref, art: "stichtag" }); setWert(z.stichtag ?? ""); setMitteilen(true); }}>
                          {z.stichtag ? "Stichtag ändern" : "Stichtag setzen"}
                        </button>
                      )}
                      {!z.ohneAuftrag && z.status !== "storniert" && (
                        <button type="button" className="cg-knopf cg-knopf-zustaendig" onClick={() => { setOffen({ ref: z.ref, art: "zustaendig" }); setWert(z.zustaendig ? String(z.zustaendig.id) : ""); }}>
                          Zuständig ändern
                        </button>
                      )}
                      {z.status === "bezahlt" && (
                        <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `${z.ref}:start`} onClick={() => senden(z.ref, "start", {})}>
                          Start anstoßen
                        </button>
                      )}
                      {!z.ohneAuftrag && !z.auftragMailAm && z.status === "offen" && (
                        <button type="button" className="cg-knopf" disabled={busy === `${z.ref}:auftragsmail`} onClick={() => senden(z.ref, "auftragsmail", {})}>
                          Vertrag + Rechnung senden
                        </button>
                      )}
                      {z.status !== "storniert" && (
                        <button type="button" className="cg-knopf cg-knopf-storno" onClick={() => { setOffen({ ref: z.ref, art: "storno" }); setWert(""); setErstattung(false); }}>
                          Auftrag stornieren
                        </button>
                      )}
                    </div>
                    {offen?.ref === z.ref && offen.art === "storno" && (() => {
                      const bezahlt = !!z.bezahltAm;
                      const mindest = bezahlt ? 10 : 3;
                      return (
                        <div className="cg-form" role="dialog" aria-label={`Auftrag ${z.firma} stornieren`}>
                          <p className="cm-fein"><b>{z.firma}</b> · {z.paketName.replace(/^FIAON /, "")} · {eur(z.betragCents)} — {bezahlt ? `bezahlt am ${datum(z.bezahltAm)}` : "nicht bezahlt"}.</p>
                          <label>Grund{bezahlt ? " (ein ganzer Satz — der Auftrag ist bezahlt)" : ""}
                            <textarea rows={3} value={wert} maxLength={1000} onChange={(e) => setWert(e.target.value)} placeholder={bezahlt ? "Zum Beispiel: Kunde beendet den Auftrag vor der Gründung, Rückzahlung mit Justin am 17.09. abgestimmt." : "Zum Beispiel: Kunde will den Auftrag nicht mehr."} />
                          </label>
                          {bezahlt && (
                            <label className="cg-haken"><input type="checkbox" checked={erstattung} onChange={(e) => setErstattung(e.target.checked)} /> mit Erstattung von {eur(z.betragCents)}</label>
                          )}
                          <p className="cm-fein">
                            {bezahlt
                              ? (erstattung
                                ? "Es wird KEIN Geld bewegt: Justin bekommt die dringende Aufgabe „Erstattung veranlassen“ und überweist von Hand. Die Bestellung geht auf storniert, gebuchte Provisionen werden zurückgenommen."
                                : "Ohne Erstattung bleibt die Zahlung gebucht und die Provision stehen — storniert wird nur der Auftrag (der Kunde beendet, die erbrachte Leistung ist bezahlt).")
                              : "Die Bestellung geht auf storniert; Erinnerungen gehen keine mehr raus."}
                            {" "}Die zuständige Person erfährt es als Aufgabe. Der Kunde bekommt keine automatische Mail.
                          </p>
                          <div className="cg-form-knoepfe">
                            <button type="button" className="cg-knopf cg-knopf-storno" disabled={wert.trim().length < mindest || busy === `${z.ref}:storno`} onClick={() => senden(z.ref, "storno", { grund: wert.trim(), erstattung: bezahlt && erstattung })}>Jetzt stornieren</button>
                            <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                          </div>
                          {wert.trim().length < mindest && <p className="cm-fein">Noch {mindest - wert.trim().length} Zeichen bis zum Grund.</p>}
                        </div>
                      );
                    })()}
                    {offen?.ref === z.ref && offen.art === "stichtag" && (
                      <div className="cg-form">
                        <label>Stichtag für Gesellschaft und EIN
                          <input type="date" value={wert} onChange={(e) => setWert(e.target.value)} />
                        </label>
                        <label className="cg-haken"><input type="checkbox" checked={mitteilen} onChange={(e) => setMitteilen(e.target.checked)} /> dem Kunden per Mail mitteilen (der Auftrag sagt die Textform zu)</label>
                        <div className="cg-form-knoepfe">
                          <button type="button" className="cg-knopf cg-knopf-haupt" disabled={!wert || busy === `${z.ref}:stichtag`} onClick={() => senden(z.ref, "stichtag", { stichtag: wert, mitteilen })}>Speichern</button>
                          <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                        </div>
                      </div>
                    )}
                    {offen?.ref === z.ref && offen.art === "zustaendig" && (
                      <div className="cg-form">
                        <label>Zuständige Person
                          <select value={wert} onChange={(e) => setWert(e.target.value)}>
                            <option value="">Bitte wählen</option>
                            {daten.mitarbeiter.map((m) => <option key={m.id} value={String(m.id)}>{m.name}{m.rolle === "vertriebsleiter" ? " · Vertriebsleitung" : ""}</option>)}
                          </select>
                        </label>
                        <p className="cm-fein">Die offene Aufgabe wandert mit, die Person bekommt eine Mail. Als Betreuer wird sie nur eingetragen, wenn bisher niemand oder die alte zuständige Person eingetragen war.</p>
                        <div className="cg-form-knoepfe">
                          <button type="button" className="cg-knopf cg-knopf-haupt" disabled={!wert || busy === `${z.ref}:zustaendig`} onClick={() => senden(z.ref, "zustaendig", { agentId: Number(wert) })}>Übergeben</button>
                          <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
