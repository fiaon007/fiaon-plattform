// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-STUDIO · „SO SIEHT ES AUS" (06.10.2026, E-294)
// /chef/s/mara?reiter=social&sicht=vorschau
//
// Konzept §2.2: das Instagram-Profil wie in der App — Profilbild, Name, Bio,
// Raster 3:4 aus der MITTE jedes 4:5-Beitrags (Instagram schneidet seit 2025
// seitlich), Reels mit Reel-Zeichen, Karussells mit Mehrfach-Zeichen — und ein
// Zeitregler „heute / in 7 Tagen / in 30 Tagen", der die geplanten Posts schon
// ins Raster stellt. So sieht man das Schachbrett hell/dunkel, bevor es entsteht.
// Prüfung 06.10.2026:
//   · Konto: Vorgabe ist das EINE Raster @fiaon.ltd mit FIAON- UND Global-Posts
//     (so steht es online, Launch 1→10). „nur FIAON“ / „nur Global“ sind Filter.
//   · „Wie in der App“ (Vorgabe): randlose Kacheln ohne Rahmen und Datum — sonst
//     prüft man das Falsche. „Markierungen“ zeigt den Status als kleinen Punkt
//     oben links und das Datum; die Liste rechts nennt ihn immer.
// Ein Tipp auf eine Kachel öffnet das Post-Detail.
// Keine Glasfläche in dieser Ansicht: das Handy steht auf einer matten Fläche.
// Daten: GET /chef/social/vorschau/instagram?tage=&marke= (Server rechnet Stichtag,
// Reihenfolge — neueste oben links — und den Zuschnitt, shared/fiaon-social.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { Geruest, Fehlermeldung, useDaten, zahl } from "../chef-teile";
import { useState } from "react";
import { useMaraRundgang } from "../mara-lage";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import { SOCIAL_API, SOCIAL_STATUS_INFO, VORSCHAU_TAGE, type SocialInstagramAntwort, type SocialRasterKachel } from "@shared/fiaon-social";
import { Handy, Avatar } from "./HandyRahmen";
import { FormatZeichen, StatusPunkt, tagKurz, tagWort, wochentag, useZurueckZurKarte, type VorschauKonto } from "./social-teile";

const RG = () => RUNDGAENGE.socialVorschau;
const TAGE_TITEL: Record<number, string> = { 0: "Heute", 7: "In 7 Tagen", 30: "In 30 Tagen" };

const KONTO_TITEL: Record<VorschauKonto, string> = { alle: "@fiaon.ltd (alles, was dort erscheint)", fiaon: "nur FIAON", global: "nur Global" };

export default function SocialVorschau({ tage, setTage, marke, setMarke, onOeffnen, stichtagHeute, zuletzt, onGerollt }: {
  tage: number; setTage: (n: number) => void; marke: VorschauKonto; setMarke: (m: VorschauKonto) => void;
  onOeffnen: (id: number) => void; stichtagHeute: string; zuletzt?: number | null; onGerollt?: () => void;
}) {
  const rg = useMaraRundgang();
  const d = useDaten<SocialInstagramAntwort>(SOCIAL_API.instagram(tage, marke));
  const [markierungen, setMarkierungen] = useState(false);
  const rundgang = <Rundgang raum="mara-social-vorschau" titel={RG().titel} schritte={RG().schritte} {...rg} />;
  const daten = d.daten;
  useZurueckZurKarte(zuletzt, !!daten, (id) => `[data-so-kachel="${id}"]`, onGerollt);

  const regler = (
    <div className="so-regler" data-so-regler>
      <span className="mara-etikett">Zeitregler</span>
      <div className="mara-ansicht" role="group" aria-label="Zeitpunkt der Vorschau">
        {VORSCHAU_TAGE.map((t) => (
          <button key={t} type="button" aria-pressed={tage === t} onClick={() => setTage(t)}>{TAGE_TITEL[t] ?? `${t} Tage`}</button>
        ))}
      </div>
      <span className="mara-etikett" style={{ marginTop: 8 }}>Konto</span>
      <div className="mara-ansicht" role="group" aria-label="Konto und Filter" data-so-konto>
        {(["alle", "fiaon", "global"] as VorschauKonto[]).map((k) => (
          <button key={k} type="button" aria-pressed={marke === k} onClick={() => setMarke(k)}>{KONTO_TITEL[k]}</button>
        ))}
      </div>
      <span className="mara-etikett" style={{ marginTop: 8 }}>Ansicht</span>
      <div className="mara-ansicht" role="group" aria-label="Markierungen im Raster" data-so-markierungen>
        <button type="button" aria-pressed={!markierungen} onClick={() => setMarkierungen(false)}>Wie in der App</button>
        <button type="button" aria-pressed={markierungen} onClick={() => setMarkierungen(true)}>Mit Markierungen</button>
      </div>
    </div>
  );

  if (d.fehler && !daten) return <div>{rundgang}{regler}<Fehlermeldung text={d.fehler} erneut={d.neu} /></div>;
  if (!daten) return <div>{rundgang}<Geruest zeilen={8} /></div>;

  const p = daten.profil;
  const geplant = daten.kacheln.filter((k) => k.geplant);
  const zurFreigabe = daten.kacheln.filter((k) => k.status === "zur_freigabe").length;
  const name = (p.handle || "@fiaon.ltd").replace(/^@/, "");

  return (
    <div>
      {rundgang}
      <div className="so-vorschau">
        <div className="so-vorschau-handy" data-so-profil>
          <Handy beschriftung={`Instagram-Profil ${p.handle} — ${TAGE_TITEL[daten.tage] ?? ""}`}>
            <div className="so-ig-leiste" aria-hidden="true" style={{ justifyContent: "center", borderBottom: 0 }}>{name}</div>
            <div className="so-ig-rolle">
              <div className="so-ig-profil">
                <div className="oben">
                  <Avatar gross />
                  <div className="zahlen">
                    <span><b>{zahl(p.beitraege)}</b><span>Beiträge</span></span>
                    <span><b>{p.follower == null ? "—" : zahl(p.follower)}</b><span>Follower</span></span>
                    <span><b>—</b><span>Gefolgt</span></span>
                  </div>
                </div>
                <div className="name">{p.name}</div>
                {p.bio ? <div className="bio">{p.bio}</div> : <div className="bio leise">Bio folgt mit „Profile & Texte“ (nächste Scheibe).</div>}
                {p.links?.length > 0 && <div className="bio" style={{ color: "#00376B", fontWeight: 600 }}>{p.links[0].replace(/^https?:\/\//, "")}</div>}
                <div className="knoepfe" aria-hidden="true"><span>Folgen</span><span>Nachricht</span></div>
              </div>
              <div className="so-ig-reiter" aria-hidden="true">
                <span className="an"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></svg></span>
                <span><FormatZeichen f="reel" className="" /></span>
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="12" cy="10" r="3" /><path d="M6.5 19c1.2-2.6 3.2-4 5.5-4s4.3 1.4 5.5 4" /></svg></span>
              </div>
              {daten.kacheln.length ? (
                <div className={`so-raster${markierungen ? " markiert" : ""}`} data-so-raster>
                  {daten.kacheln.map((k) => <Kachel key={k.post_id} k={k} heute={stichtagHeute} onOeffnen={onOeffnen} markiert={markierungen} />)}
                </div>
              ) : (
                <p className="so-ohne">Bis zu diesem Tag steht noch kein Beitrag für dieses Konto im Plan.</p>
              )}
            </div>
          </Handy>
        </div>

        <div className="so-vorschau-seite">
          <section className="mara-karte">
            {regler}
            <p className="mara-satz" style={{ marginTop: 14 }}>
              {daten.tage === 0
                ? "So steht das Profil heute — mit allem, was bis heute geplant ist."
                : `So steht das Profil ${daten.tage === 7 ? "in 7 Tagen" : "in 30 Tagen"} (${wochentag(daten.stichtag)} ${tagKurz(daten.stichtag)}), wenn alles Geplante bis dahin online geht.`}
            </p>
            {daten.nur_filter ? (
              <p className="mara-hinweis warn" style={{ marginTop: 10 }}><span className="mara-punkt warn" />
                <span>Gefiltert: nur {daten.marke === "global" ? "Global" : "FIAON"}-Posts. Im echten Profil {p.handle} stehen die anderen dazwischen — für das echte Schachbrett „{KONTO_TITEL.alle}“ wählen.</span></p>
            ) : (
              <p className="mara-still mara-klein" style={{ marginTop: 10 }}>
                Ein Raster für {p.handle}: FIAON- und Global-Posts in der Reihenfolge, in der sie online gehen{daten.marke === "global" ? "" : " — ein eigenes Global-Konto gibt es noch nicht"}.
              </p>
            )}
            {markierungen ? (
              <div className="so-raster-legende" style={{ marginTop: 10 }}>
                <span><i className="live" />online (ohne Punkt)</span>
                <span><i className="geplant" />geplant, mit Datum</span>
                <span><i className="frei" />wartet auf Freigabe</span>
              </div>
            ) : (
              <p className="mara-still mara-klein" style={{ marginTop: 10 }}>Wie in der App: ohne Rahmen und Datum. Was noch geplant ist, steht in der Liste — oder „Mit Markierungen“ wählen.</p>
            )}
            <p className="mara-still mara-klein" style={{ marginTop: 10 }}>
              Raster 3:4 aus der Mitte jedes 4:5-Beitrags, Reels zeigen ihr Titelbild — so schneidet Instagram seit 2025. Neueste oben links.
            </p>
          </section>
          {(geplant.length > 0 || zurFreigabe > 0) && (
            <section className="mara-karte">
              <h3>Bis dahin neu im Raster: {zahl(geplant.length)}</h3>
              {zurFreigabe > 0 && <p className="mara-hinweis warn" style={{ marginTop: 8 }}><span className="mara-punkt warn" /><span>{zahl(zurFreigabe)} davon {zurFreigabe === 1 ? "wartet" : "warten"} noch auf deine Freigabe.</span></p>}
              <ul className="mara-liste" style={{ marginTop: 8 }}>
                {geplant.slice(0, 12).map((k) => (
                  <li key={k.post_id} className="mara-reihe">
                    <span className="mara-still" style={{ fontVariantNumeric: "tabular-nums", minWidth: 92 }}>{tagWort(k.plan_datum, stichtagHeute)}{k.plan_zeit ? `, ${k.plan_zeit}` : ""}</span>
                    <button type="button" className="mara-knopf text" onClick={() => onOeffnen(k.post_id)}>{k.titel}</button>
                    <span className={`mara-pille ${k.status === "zur_freigabe" ? "warn" : "akz"}`}>{SOCIAL_STATUS_INFO[k.status].kurz}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Kachel({ k, heute, onOeffnen, markiert }: { k: SocialRasterKachel; heute: string; onOeffnen: (id: number) => void; markiert: boolean }) {
  const titel = `${k.titel} — ${SOCIAL_STATUS_INFO[k.status].titel}${k.geplant ? `, geplant ${tagWort(k.plan_datum, heute)}` : ""}`;
  return (
    <button type="button" onClick={() => onOeffnen(k.post_id)} title={titel} aria-label={titel} data-so-kachel={k.post_id}>
      {k.bild ? <img src={k.bild.url} alt="" loading="lazy" decoding="async" /> : null}
      {k.symbol && <FormatZeichen f={k.symbol} />}
      {/* Markierungen nur auf Wunsch: kleiner Punkt oben links statt Rahmen, Datum unten. */}
      {markiert && k.geplant && <span className="marke"><StatusPunkt s={k.status} /></span>}
      {markiert && k.geplant && <span className="geplant">{tagKurz(k.plan_datum)}</span>}
    </button>
  );
}
