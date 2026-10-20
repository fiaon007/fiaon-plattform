// ═══════════════════════════════════════════════════════════════════════════
// /chef/ki · /chef/s/ki-heute — HEUTE: Mara und Aras an einem Tag (E-409, 19.10.2026)
//
// Die Bühne (ein Glas) zeigt die Zahlen des Tages. Darunter matt: Entscheidungs-
// karten (E-370/E-397 + Prüf-Mara), „Mara heute“ (selbst erledigt je Art, Gelb mit
// Rückgängig, Aufräumen, wo es hängt), Kosten, Prüf-Mara. Takt 30 s.
//
// E-409 × E-406 (20.10.2026): Maras Zahlen kommen aus DERSELBEN Quelle wie die kurze
// Karte im Lagezimmer (maraHeuteLesen). Not-Aus über ALLE Mara-Wege; „Wieder an“
// fragt vorher und stellt genau den Stand von vorher her. Karten: Links bleiben Links,
// vorsichtige Wahl fragt nach (wie im Mara-Steuerpult). Die Leitung sieht keine
// Kundennamen und entscheidet nicht (das tut der Inhaber).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { akteLink } from "@/lib/akte-link";
import type { KiHeute, GelbSicht } from "@shared/fiaon-ki-team";
import { Kopf, KiRundgang, NichtVerbunden, Fehler, Stand, Meldung, useMeldung, useTakt, senden, euro, zahl, seitKurz, tagZeit } from "./ki-teile";

type Ton = "gut" | "neutral" | "vorsicht";
interface Option { key: string; label: string; ton: Ton; link: string | null; titel: string | null }
interface KarteSicht {
  id: number; art: string; artText: string; personId: number | null; name: string | null; titel: string; text: string; empfehlung: string | null;
  optionen: Option[]; status: string; ergebnis: string | null; fehler: string | null; createdAt: string;
}

/** Eine Wahl auf einer Karte: Links bleiben Links (sie öffnen die Akte oder das Gespräch) — kein Klick an den Server. */
function KartenWahl({ o, haupt, busy, darf, onKlick }: { o: Option; haupt?: boolean; busy: boolean; darf: boolean; onKlick: () => void }) {
  const klasse = `ki-knopf klein${haupt ? " haupt" : ""}${!haupt && o.ton === "vorsicht" ? " warn" : ""}`;
  if (o.link) return <a className={klasse} href={o.link} title={o.titel ?? undefined}>{o.label}</a>;
  return <button type="button" className={klasse} disabled={busy || !darf} title={darf ? (o.titel ?? undefined) : "Entscheiden darf der Inhaber."} onClick={onKlick}>{o.label}</button>;
}

/** Vor einer vorsichtigen Wahl (Widerruf annehmen …) fragen — dieselbe Regel wie im Mara-Steuerpult. */
function mussNachfragen(o: Option, empfehlung: string | null): boolean {
  return o.ton === "vorsicht" && o.key !== empfehlung && !o.link;
}

const LEER: KiHeute["mara"]["notaus"] = { aktiv: false, seit: null, von: null, wege: [] };

export default function ChefKiHeute() {
  const { daten, fehler, laedt, neu, geladenAm } = useTakt<KiHeute & { ok: boolean }>("/chef/ki/heute", 60_000); // E-409 Fund 13: alle 60 s (viele Quellen je Abruf), versteckt gar nicht
  const [busy, setBusy] = useState<string | null>(null);
  const meld = useMeldung();
  const d = daten && daten.mara ? daten : null;
  const notaus = d?.mara.notaus ?? LEER;
  const darf = d?.darf ?? { namen: false, entscheiden: false, rueckgaengig: false, notaus: false };

  // E-409 × E-408: EIN Not-Aus für das ganze KI-Team — alle Mara-Wege UND Aras (über seinen eigenen Not-Aus, aras_notaus).
  const maraAnhalten = async () => {
    const wege = notaus.wege.filter((w) => w.an).map((w) => `· ${w.label}`);
    if (notaus.aras?.verbunden && !notaus.aras.angehalten) wege.push("· Aras (Telefon) — laufende Gespräche enden mit einem Abschiedssatz");
    if (!window.confirm(`Not-Aus? Das stoppt sofort:\n${wege.join("\n") || "· (alles schon aus)"}\n\nMails und WhatsApps, die gerade entstehen, laufen zu Ende. „Wieder an“ stellt danach genau diesen Stand her.`)) return;
    setBusy("mara");
    try { const r = await senden<{ aras: { text: string } | null }>("/chef/ki/mara/notaus", { an: true }); meld.gut(`Angehalten — alle Mara-Wege.${r.aras ? ` ${r.aras.text}` : ""}`); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const maraWiederAn = async () => {
    const zurueck = notaus.wege.map((w) => `· ${w.label}: ${w.vorherAn === false ? "bleibt aus" : "wieder an"}`);
    const a = notaus.aras;
    if (a && a.vorherAngehalten !== null) zurueck.push(`· Aras (Telefon): ${a.vorherAngehalten ? "bleibt angehalten (war es schon vorher)" : a.verbunden ? "wieder frei" : "nicht verbunden — bleibt angehalten"}`);
    if (!window.confirm(`Wieder starten?\n\nEs gilt genau der Stand von vor dem Not-Aus${notaus.seit ? ` (${tagZeit(notaus.seit)})` : ""}:\n${zurueck.join("\n")}`)) return;
    setBusy("mara");
    try { const r = await senden<{ aras: { text: string } | null }>("/chef/ki/mara/notaus", { an: false }); meld.gut(`Läuft wieder — wie vor dem Not-Aus.${r.aras ? ` ${r.aras.text}` : ""}`); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const arasSchalten = async (stop: boolean) => {
    if (!window.confirm(stop ? "Aras Not-Aus? Laufende Gespräche enden mit einem Abschiedssatz." : "Aras wieder wählen lassen?")) return;
    setBusy("aras");
    try { await senden(stop ? "/chef/aras/notaus" : "/chef/aras/start", { grund: "Heute-Seite" }); meld.gut(stop ? "Aras gestoppt." : "Aras darf wieder wählen."); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const entscheiden = async (k: KarteSicht, o: Option) => {
    if (mussNachfragen(o, k.empfehlung) && !window.confirm(`${o.label}?${o.titel ? `\n\n${o.titel}` : ""}`)) return;
    setBusy(`k${k.id}`);
    try { await senden("/chef/mara/entscheidungen/entscheiden", { id: k.id, option: o.key }); meld.gut("Entschieden."); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const spaeter = async (k: KarteSicht) => {
    setBusy(`k${k.id}`);
    try { await senden("/chef/mara/entscheidungen/spaeter", { id: k.id }); neu(); } catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const zurueck = async (g: GelbSicht, k: GelbSicht["knoepfe"][number]) => {
    if (k.vorsicht && !window.confirm(`${k.label}?\n\n${g.name ? `${g.name}: ` : ""}${g.text}`)) return;
    setBusy(`g${g.art}:${g.id}`);
    try { const r = await senden<{ text: string }>("/chef/mara-heute/rueckgaengig", { art: k.art, id: g.id }); meld.gut(r.text); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };

  const karten = ((d?.karten ?? []) as KarteSicht[]);
  const kostenSumme = (d?.kosten ?? []).reduce((s, k) => s + k.euro, 0);
  const aus = notaus.wege.filter((w) => !w.an).length;
  const status = notaus.aktiv ? { ton: "krit", punkt: "krit", text: "angehalten" } : aus ? { ton: "", punkt: "gelb", text: `${aus} ${aus === 1 ? "Weg" : "Wege"} aus` } : { ton: "gut", punkt: "gut", text: "arbeitet" };

  return (
    <div className="ki ki-heute">
      <KiRundgang schluessel="kiHeute" raum="ki-heute" />
      <Kopf titel="KI-Team · Heute" satz="Was Mara und Aras heute getan haben — und was dich braucht." kinder={
        <>
          {d?.kiBand?.an ? <a className="ki-pille krit" href="/chef/s/mara" title="Die KI ist pausiert — im Mara-Steuerpult wieder aktivieren.">KI pausiert</a> : <span className="ki-pille gut" title={`Anbieter: ${d?.kiBand?.anbieter ?? "—"}`}>KI läuft</span>}
          {d?.waBremse?.pause ? <a className="ki-pille krit" href="/chef/s/mara" title={d.waBremse.satz ?? ""}>WhatsApp pausiert</a> : d?.waBremse?.qualitaet === "RED" ? <span className="ki-pille krit" title={d.waBremse.satz ?? ""}>Meta ROT</span> : d?.waBremse?.qualitaet === "YELLOW" ? <span className="ki-pille"><span className="ki-punkt gelb" aria-hidden="true" />Meta GELB</span> : null}
          <Stand am={geladenAm} neu={neu} fehler={fehler} />
        </>
      } />
      {fehler && !d ? <Fehler text={fehler} erneut={neu} /> : null}
      {laedt && !d ? <div className="ki-leer">lädt …</div> : null}
      {d && (
        <>
          <section className="ki-buehne" data-ki="buehne" aria-label="Heute in Zahlen">
            <div className="ki-raster zwei">
              <div>
                <div className="ki-chips" style={{ marginBottom: 10 }}>
                  <span className="ki-etikett">Mara</span>
                  <span className={`ki-pille ${status.ton}`} title={notaus.wege.map((w) => `${w.label}: ${w.an ? "an" : "aus"}`).join(" · ")}>
                    <span className={`ki-punkt ${status.punkt}`} aria-hidden="true" />{status.text}
                  </span>
                  {darf.notaus ? (
                    notaus.aktiv
                      ? <button type="button" className="ki-knopf klein haupt" data-ki="mara-wieder-an" disabled={busy === "mara"} onClick={maraWiederAn} title="Stellt genau den Stand von vor dem Not-Aus her — fragt vorher.">Wieder an</button>
                      : <button type="button" className="ki-knopf klein krit" data-ki="mara-notaus" disabled={busy === "mara"} onClick={maraAnhalten} title="Hält ALLE Mara-Wege und Aras in einem Zug an — fragt vorher.">Not-Aus</button>
                  ) : null}
                </div>
                <div className="ki-zahlen">
                  <div><span className="ki-zahl">{zahl(d.mara.erledigt)}</span><small title="Was Mara heute ohne einen Menschen erledigt hat">selbst erledigt</small></div>
                  <div><span className="ki-zahl">{zahl(d.mara.mails.geschrieben)}</span><small title={`${zahl(d.mara.mails.entwuerfe)} Entwürfe warten · ${zahl(d.mara.mails.reinHeute)} Mails heute herein`}>Mails geschrieben</small></div>
                  <div><span className="ki-zahl">{zahl(d.mara.whatsapps.raus)}</span><small title={`${zahl(d.mara.whatsapps.rein)} herein · ${zahl(d.mara.whatsapps.menschen)} Menschen`}>WhatsApps raus</small></div>
                  <div><span className="ki-zahl">{zahl(d.mara.entscheidungen.offen)}</span><small title={`${zahl(d.mara.entscheidungen.geldRecht)} davon Geld/Recht`}>Entscheidungen offen</small></div>
                </div>
                {d.mara.geld ? <p className="ki-still ki-klein ki-abstand" title="Gebucht heute (eine Quelle mit dem ganzen Chefbüro) — „nach Maras Kontakt“ ist eine zeitliche Folge, kein Beweis.">Geld heute {euro(d.mara.geld.heuteCents / 100)} ({zahl(d.mara.geld.zahlungen)}) · nach Maras Kontakt {euro(d.mara.geld.nachMaraCents / 100)}</p> : null}
              </div>
              <div>
                <div className="ki-chips" style={{ marginBottom: 10 }}>
                  <span className="ki-etikett">Aras</span>
                  {d.aras?.verbunden ? (
                    <>
                      <span className={`ki-pille ${d.aras.notaus ? "krit" : d.aras.an ? "gut" : ""}`}><span className={`ki-punkt ${d.aras.notaus ? "krit" : d.aras.an ? "gut" : "gelb"}`} aria-hidden="true" />{d.aras.notaus ? "Not-Aus" : d.aras.an ? "wählt" : "aus"}</span>
                      {darf.notaus ? <button type="button" className={`ki-knopf klein ${d.aras.notaus ? "haupt" : "krit"}`} data-ki="aras-notaus" disabled={busy === "aras"} onClick={() => arasSchalten(!d.aras!.notaus)}>{d.aras.notaus ? "Wieder an" : "Not-Aus"}</button> : null}
                    </>
                  ) : <a className="ki-pille" href="/chef/s/aras">noch nicht verbunden</a>}
                </div>
                {d.aras?.verbunden ? (
                  <div className="ki-zahlen">
                    <div><span className="ki-zahl">{zahl(d.aras.gewaehlt)}</span><small title={`${zahl(d.aras.erreicht)} erreicht`}>gewählt</small></div>
                    <div><span className="ki-zahl">{zahl(d.aras.gespraeche)}</span><small title={`${zahl(d.aras.laufend)} laufen gerade`}>Gespräche</small></div>
                    <div><span className="ki-zahl">{zahl(d.aras.zusagen)}</span><small>Zusagen</small></div>
                    <div><span className="ki-zahl klein">{euro(d.aras.euro)}</span><small>Kosten heute</small></div>
                  </div>
                ) : <NichtVerbunden />}
              </div>
            </div>
            <Meldung m={meld.m} />
          </section>

          <section className="ki-karte ki-abstand" data-ki="karten" aria-label="Entscheidungen">
            <h2>Was dich braucht <span className="ki-still ki-klein">· {zahl(d.mara.entscheidungen.offen)} offen{d.pruefung.offenKarten ? ` · ${zahl(d.pruefung.offenKarten)} von Prüf-Mara` : ""} · <a href="/chef/s/mara?reiter=entscheidungen">alle</a></span></h2>
            {!darf.entscheiden && karten.length ? <p className="ki-still ki-klein">Entscheiden darf der Inhaber — Namen siehst du hier nicht.</p> : null}
            {karten.length === 0 ? <div className="ki-leer"><b>Nichts offen.</b>Mara hat heute keine Frage an dich.</div> : (
              <ul className="ki-liste">
                {karten.map((k) => {
                  const link = k.personId && darf.namen ? akteLink(k.personId, "chef") : null;
                  const empf = k.optionen.find((o) => o.key === k.empfehlung) ?? null;
                  const andere = k.optionen.filter((o) => o !== empf);
                  return (
                    <li key={k.id} className="ki-zeile">
                      <div className="ki-zeile-kopf">
                        <span className="ki-etikett">{k.artText}</span>
                        {link ? <a href={link}>{k.name || `Person ${k.personId}`}</a> : null}
                        <b>{k.titel}</b>
                      </div>
                      <div className="ki-chips">
                        {empf ? <KartenWahl o={empf} haupt busy={busy === `k${k.id}`} darf={darf.entscheiden} onKlick={() => entscheiden(k, empf)} /> : null}
                        {andere.slice(0, 3).map((o) => <KartenWahl key={o.key} o={o} busy={busy === `k${k.id}`} darf={darf.entscheiden} onKlick={() => entscheiden(k, o)} />)}
                        {darf.entscheiden ? <button type="button" className="ki-knopf text ki-klein" disabled={busy === `k${k.id}`} onClick={() => spaeter(k)} title="Drei Tage aus der Liste">Später</button> : null}
                      </div>
                      <span className="ki-zeile-satz">{k.text.length > 220 ? `${k.text.slice(0, 217)}…` : k.text}{k.fehler ? <span className="ki-krit-t"> · {k.fehler}</span> : null}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="ki-karte ki-abstand" data-ki="mara-heute" aria-label="Mara heute">
            <h2>Mara heute <span className="ki-still ki-klein">· {zahl(d.mara.erledigt)} selbst erledigt · <a href="/chef/s/ki-werkzeuge">Ampel</a></span></h2>
            {d.mara.zeilen.length ? (
              <div className="ki-chips">
                {d.mara.zeilen.map((z) => <a key={z.art} className="ki-pille" href={z.link} data-art={z.art}><b className="ki-leise">{zahl(z.n)}</b> {z.text}</a>)}
              </div>
            ) : <p className="ki-still ki-klein">Heute noch nichts — Mara arbeitet 08–20 Uhr.</p>}
            {d.mara.aufraeumen.length || d.mara.haengt.length ? (
              <ul className="ki-liste ki-abstand">
                {d.mara.aufraeumen.map((a) => <li key={a.art} className="ki-zeile"><div className="ki-zeile-kopf"><span className="ki-etikett">Vorschlag</span><a href="/chef/s/mara?reiter=entscheidungen">{a.titel}</a></div><span className="ki-zahl">{zahl(a.anzahl)}</span></li>)}
                {d.mara.haengt.map((h) => <li key={h.agentId} className="ki-zeile"><div className="ki-zeile-kopf"><span className="ki-etikett">hängt</span><a href={`/chef/s/team?agent=${h.agentId}`}>{h.name}</a><span className="ki-still ki-klein">{[h.termineOhneErgebnis ? `${zahl(h.termineOhneErgebnis)} Termine ohne Ergebnis` : null, h.auftraegeUeberfaellig ? `${zahl(h.auftraegeUeberfaellig)} Aufträge überfällig` : null].filter(Boolean).join(" · ")}</span></div></li>)}
              </ul>
            ) : null}
            <h3 className="ki-abstand" data-ki="gelb">Gelb — 24 Stunden <span className="ki-still ki-klein">· gelb heißt: Mara macht es, du siehst es hier</span></h3>
            {d.mara.gelb.length === 0 ? <p className="ki-still ki-klein">Nichts Gelbes in den letzten 24 Stunden.</p> : (
              <ul className="ki-liste">
                {d.mara.gelb.slice(0, 30).map((g) => {
                  const link = g.personId && darf.namen ? akteLink(g.personId, "chef") : null;
                  return (
                    <li key={`${g.art}:${g.id}`} className="ki-zeile" data-ki-gelb={g.art}>
                      <div className="ki-zeile-kopf">
                        <span className="ki-punkt gelb" aria-hidden="true" />
                        {link ? <a href={link}>{g.name || "Akte"}</a> : null}
                        <span>{g.text}</span>
                      </div>
                      <div className="ki-chips">
                        {g.erledigt ? <span className="ki-still ki-klein">{g.erledigt.ergebnis || "erledigt"}{g.erledigt.von ? ` · ${g.erledigt.von}` : ""}</span>
                          : g.knoepfe.length && darf.rueckgaengig ? g.knoepfe.map((k) => (
                            <button key={k.art} type="button" className={`ki-knopf klein${k.vorsicht ? " warn" : ""}`} disabled={busy === `g${g.art}:${g.id}`} onClick={() => zurueck(g, k)}>{k.label}</button>
                          ))
                            : <span className="ki-still ki-klein">{g.knoepfe.length ? "Rückgängig: nur Inhaber" : g.ohne || "nicht rückgängig"}</span>}
                      </div>
                      <span className="ki-zeile-satz">{seitKurz(g.am)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="ki-raster zwei ki-abstand">
            <section className="ki-karte" data-ki="kosten" aria-label="Kosten heute">
              <h2>Kosten heute <span className="ki-still ki-klein">· {euro(kostenSumme)} · <a href="/chef/s/ki-einstellungen#kasse">Kasse</a></span></h2>
              {d.kosten.length === 0 ? <p className="ki-still">Heute noch keine KI-Kosten.</p> : (
                <ul className="ki-liste">
                  {d.kosten.slice(0, 8).map((k) => {
                    const voll = k.deckel ? Math.min(100, Math.round((k.euro / k.deckel) * 100)) : null;
                    return (
                      <li key={k.dienst} className="ki-zeile ki-zeile-rechts" title={k.deckel ? `Deckel ${euro(k.deckel)} je Tag` : "kein Deckel"}>
                        <div className="ki-zeile-kopf"><b>{k.label}</b>{voll != null && voll >= 90 ? <span className="ki-pille"><span className="ki-punkt gelb" aria-hidden="true" />Deckel fast erreicht</span> : null}</div>
                        <span className="ki-zahl">{euro(k.euro)}</span>
                        <span className="ki-zeile-satz"><span className="ki-balken"><i className={voll != null && voll >= 90 ? "voll" : ""} style={{ width: `${voll ?? Math.round(k.anteil)}%` }} /></span></span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section className="ki-karte" data-ki="pruef" aria-label="Prüf-Mara">
              <h2>Prüf-Mara <span className="ki-still ki-klein">· <a href="/chef/s/ki-qualitaet">Qualität</a></span></h2>
              <div className="ki-zahlen">
                <div><span className="ki-zahl klein">{zahl(d.pruefung.heute)}</span><small>heute geprüft</small></div>
                <div><span className="ki-zahl klein">{zahl(d.pruefung.auffaellig)}</span><small>auffällig</small></div>
              </div>
              <p className="ki-still ki-klein ki-abstand">Eine zweite KI prüft Maras Arbeit — Mitarbeiter prüfen nichts gegen.</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
