// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-STUDIO · POST-DETAIL (06.10.2026, E-294)
// /chef/s/mara?reiter=social&sicht=plan&post=<id>
//
// Das Herzstück (Konzept §2.3): links das Handy mit der echten Vorschau — die
// EINE Glasfläche dieser Ansicht —, rechts matt die Arbeit:
//   · Was jetzt? Die Status-Knöpfe mit ihren Pflichtfeldern:
//       Freigeben (Wort-Check rot sperrt; „Trotzdem freigeben" nur Inhaber, mit
//       Grund), Zurück an Claude (was soll anders — Pflicht), Verschieben,
//       Als veröffentlicht melden (Link je Kanal Pflicht, KI-Haken vorher),
//       Verwerfen (Grund Pflicht).
//   · Texte mit „Kopieren" und Zeichenzählung je Kanal (IG 2.200, LinkedIn 3.000 …).
//   · Dateien einzeln oder als ZIP in Upload-Reihenfolge (Foliennummer im Namen).
//   · Checkliste je Kanal mit dem KI-Pflichthaken; KI-Kennzeichnung ja/nein + Grund.
//   · Wort-Check je Feld und der Verlauf.
// Jede Aktion schickt `version` mit; der Server antwortet 409, wenn jemand
// anderes (Florentine, ein neuer Import) schneller war — dann lädt die Seite neu.
// Der Server prüft alles noch einmal (Übergänge, Wort-Check, KI-Haken, Links).
// Prüfung 06.10.2026: Am Handy „In Fotos sichern“ (Teilen-Blatt mit allen Folien
// in Reihenfolge bzw. Reel + Titelbild) neben „Kopieren“ der Caption — Instagram
// wählt aus „Fotos“, ein Download landet in der Dateien-App. „Zurück an Claude“
// sagt ehrlich, dass Claude die Notiz in Scheibe 1 nicht selbst liest.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Geruest, Fehlermeldung, useDaten, zahl } from "../chef-teile";
import { useMaraRundgang, useMeldung, Meldung, tagZeitBerlin } from "../mara-lage";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import { SozialFehler, kopieren, sozialAktion, Kanaele, KanalKuerzel, StatusPille, FormatEtikett, tagWort, groesse, kannDateienTeilen, dateienHolen } from "./social-teile";
import { HandyRahmen } from "./HandyRahmen";
import {
  SOCIAL_API, SOCIAL_STATUS_INFO, KANAL_INFO, GRUND_MIN, KI_PUNKT, SOCIAL_AUSNAHMEN, zeichenZaehlen,
  offenePflichtpunkte, permalinkPruefen, istPlanDatum, istPlanZeit, wortTrefferZahl,
  type SocialPostAntwort, type SocialPostDetail, type SocialIch, type SocialAktionKoerper, type SocialKanal, type SocialAktion, type SocialWortFeld,
} from "@shared/fiaon-social";
import { SOZIALE_PROFILE } from "@shared/fiaon-sozial";

const IG_HANDLE = SOZIALE_PROFILE.find((p) => p.kanal === "instagram")?.handle ?? "@fiaon.ltd";
/** Instagram nimmt höchstens 30 Hashtags je Beitrag an. */
const IG_HASHTAGS_MAX = 30;
const RG = () => RUNDGAENGE.socialPost;

function heute(): string {
  const t: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())) t[p.type] = p.value;
  return `${t.year}-${t.month}-${t.day}`;
}

export default function SocialPost({ id, zurueckText, onZurueck, onGeaendert }: {
  id: number; zurueckText: string; onZurueck: () => void; onGeaendert?: () => void;
}) {
  const rg = useMaraRundgang();
  const d = useDaten<SocialPostAntwort>(SOCIAL_API.post(id));
  const [post, setPost] = useState<SocialPostDetail | null>(null);
  const [ich, setIch] = useState<SocialIch | null>(null);
  useEffect(() => { if (d.daten) { setPost(d.daten.post); setIch(d.daten.ich); } }, [d.daten]);
  // Nach dem Öffnen liegt der Fokus auf der Überschrift, nicht auf BODY — Tastatur und
  // Bildschirmleser starten beim Post, nicht wieder ganz oben.
  const fokussiert = useRef(false);
  useEffect(() => {
    if (!post || fokussiert.current) return;
    fokussiert.current = true;
    try { (document.getElementById("so-post-titel") as HTMLElement | null)?.focus({ preventScroll: true }); } catch { /* egal */ }
  }, [post]);

  const rundgang = <Rundgang raum="mara-social-post" titel={RG().titel} schritte={RG().schritte} {...rg} />;
  const zurueck = <div className="so-zurueck"><button type="button" className="mara-knopf text" onClick={onZurueck}>← {zurueckText}</button></div>;
  if (d.fehler && !post) return <div>{rundgang}{zurueck}<Fehlermeldung text={d.fehler} erneut={d.neu} /></div>;
  if (!post || !ich) return <div>{rundgang}{zurueck}<Geruest zeilen={10} /></div>;
  return (
    <div>
      {rundgang}
      {zurueck}
      <PostAnsicht post={post} ich={ich} setPost={setPost} neuLaden={d.neu} onGeaendert={onGeaendert} />
    </div>
  );
}

function PostAnsicht({ post, ich, setPost, neuLaden, onGeaendert }: {
  post: SocialPostDetail; ich: SocialIch; setPost: (p: SocialPostDetail) => void; neuLaden: () => void; onGeaendert?: () => void;
}) {
  const [titelbild, setTitelbild] = useState(false);
  const { meldung, melden, zu } = useMeldung();
  const [busy, setBusy] = useState<string | null>(null);
  const [roteFelder, setRoteFelder] = useState<SocialWortFeld[] | null>(null);

  /** Eine Aktion ausführen: Antwort übernehmen, Meldung am Ort, Zahlmarke am Reiter nachziehen. */
  const tun = async <A extends SocialAktion>(aktion: A, koerper: SocialAktionKoerper[A], ort: string): Promise<boolean> => {
    setBusy(aktion);
    try {
      const a = await sozialAktion(post.id, aktion, koerper);
      setPost(a.post);
      setRoteFelder(null);
      melden(a.meldung || "Erledigt.", ort);
      onGeaendert?.();
      return true;
    } catch (e) {
      const f = e as SozialFehler;
      if (f.code === "VERSION_VERALTET") neuLaden();
      if (f.code === "WORTCHECK_ROT" && f.daten?.felder) setRoteFelder(f.daten.felder);
      melden(f.message, ort, true);
      return false;
    } finally { setBusy(null); }
  };

  const plan = `${tagWort(post.plan_datum, heute())}${post.plan_zeit ? `, ${post.plan_zeit} Uhr` : " · ohne Uhrzeit"}`;
  const istReel = post.format === "reel";
  const hatCover = post.dateien.some((x) => x.rolle === "cover");

  return (
    <div className="so-detail">
      {/* DIE EINE Glasfläche: das Handy. */}
      <div className="mara-glas so-handy-glas">
        <HandyRahmen post={post} handle={IG_HANDLE} titelbild={istReel && titelbild} />
        {istReel && hatCover && (
          <div className="so-ansicht-wahl">
            <div className="mara-ansicht" role="group" aria-label="Reel-Vorschau">
              <button type="button" aria-pressed={!titelbild} onClick={() => setTitelbild(false)}>Reel</button>
              <button type="button" aria-pressed={titelbild} onClick={() => setTitelbild(true)}>Titelbild</button>
            </div>
          </div>
        )}
        <p className="mara-still mara-klein" style={{ textAlign: "center" }}>
          {post.format === "karussell" ? "Wischen, ziehen oder Pfeiltasten — wie in der App." : istReel ? "Tippen spielt mit Ton." : "So erscheint der Beitrag im Feed."}
        </p>
      </div>

      <div className="so-detail-arbeit">
        <section className="mara-karte so-detail-kopf" aria-labelledby="so-post-titel">
          <div className="so-meta">
            <StatusPille s={post.status} />
            <FormatEtikett f={post.format} />
            <Kanaele liste={post.kanaele} />
            <span className="mara-pille">{post.marke === "global" ? "FIAON Global" : "FIAON"}</span>
          </div>
          <h2 id="so-post-titel" tabIndex={-1} style={{ outline: "none" }}>{post.titel}</h2>
          <div className="so-meta">
            <span className="tabzahl">{plan}</span>
            {post.serie && <span>Serie: {post.serie}</span>}
            <span className="tabzahl" title="Jede neue Fassung von Claude zählt hoch; Änderungen im Studio stehen im Verlauf.">Fassung {post.fassung}</span>
            <span className="mara-still">{post.extern_id}</span>
          </div>
          {post.status === "entwurf" && post.zurueck_notiz && (
            <p className="mara-hinweis warn"><span className="mara-punkt warn" /><span>Liegt bei Claude: „{post.zurueck_notiz}“ — Claude in der Social-Sitzung Bescheid sagen.</span></p>
          )}
          {post.freigabe?.am && (
            <p className={`mara-hinweis${post.freigabe.trotz_rot ? " warn" : ""}`}>
              <span className={`mara-punkt ${post.freigabe.trotz_rot ? "warn" : "gut"}`} />
              <span>Freigegeben {post.freigabe.von ? `von ${post.freigabe.von} ` : ""}am {tagZeitBerlin(post.freigabe.am)}
                {post.freigabe.trotz_rot ? ` — trotz rotem Wort-Check. Grund: „${post.freigabe.grund ?? ""}“` : ""}</span>
            </p>
          )}
          {Object.keys(post.veroeffentlicht ?? {}).length > 0 && (
            <ul className="mara-liste">
              {(Object.entries(post.veroeffentlicht) as [SocialKanal, { am: string; permalink: string }][]).map(([k, v]) => (
                <li key={k} className="mara-reihe"><KanalKuerzel k={k} /><span>veröffentlicht {tagZeitBerlin(v.am)}</span>
                  <a href={v.permalink} target="_blank" rel="noopener noreferrer">Beitrag öffnen</a></li>
              ))}
            </ul>
          )}
          {post.meta_hinweise?.length > 0 && (
            <div className="mara-hinweise">{post.meta_hinweise.map((h, i) => <p key={i} className="mara-hinweis"><span className="mara-punkt" /><span>{h}</span></p>)}</div>
          )}
        </section>

        <Aktionen post={post} ich={ich} busy={busy} tun={tun} roteFelder={roteFelder} />
        <Meldung m={meldung} ort="aktion" onZu={zu} />

        <WortCheck post={post} />
        <Texte post={post} />
        <Dateien post={post} />
        <Checkliste post={post} ich={ich} busy={busy} tun={tun} />
        <Meldung m={meldung} ort="check" onZu={zu} />
        <Verlauf post={post} />
      </div>
    </div>
  );
}

// ── Status-Knöpfe mit Pflichtfeldern ──────────────────────────────────────
type Tun = <A extends SocialAktion>(aktion: A, koerper: SocialAktionKoerper[A], ort: string) => Promise<boolean>;

function Aktionen({ post, ich, busy, tun, roteFelder }: { post: SocialPostDetail; ich: SocialIch; busy: string | null; tun: Tun; roteFelder: SocialWortFeld[] | null }) {
  const [offen, setOffen] = useState<SocialAktion | "trotzdem" | null>(null);
  const [grund, setGrund] = useState("");
  const [datum, setDatum] = useState(post.plan_datum);
  const [zeit, setZeit] = useState(post.plan_zeit ?? "");
  const [links, setLinks] = useState<Partial<Record<SocialKanal, string>>>({});
  useEffect(() => { setDatum(post.plan_datum); setZeit(post.plan_zeit ?? ""); }, [post.plan_datum, post.plan_zeit]);

  const darf = (a: SocialAktion) => post.erlaubte_aktionen.includes(a);
  const auf = (a: SocialAktion | "trotzdem") => { setOffen((o) => (o === a ? null : a)); setGrund(""); };
  const zu = () => { setOffen(null); setGrund(""); };
  const grundOk = grund.trim().length >= GRUND_MIN;
  const sperreFrei = post.sperren?.freigeben;
  const rot = post.wortcheck?.ergebnis === "rot";
  const offeneKanaele = post.kanaele.filter((k) => !post.veroeffentlicht?.[k]);
  const pflichtFehlt = (k: SocialKanal) => offenePflichtpunkte(post.checkliste_soll, post.checkliste, k);

  const meldungen = offeneKanaele
    .map((k) => ({ kanal: k, permalink: (links[k] ?? "").trim() }))
    .filter((m) => m.permalink);
  const linkFehler = (k: SocialKanal) => { const l = (links[k] ?? "").trim(); return l ? permalinkPruefen(k, l) : null; };
  const meldenOk = meldungen.length > 0 && meldungen.every((m) => !permalinkPruefen(m.kanal, m.permalink) && !pflichtFehlt(m.kanal).length);
  const zeitOk = istPlanDatum(datum) && (zeit === "" || istPlanZeit(zeit));

  const nichts = !["freigeben", "zurueck", "verschieben", "veroeffentlicht", "verwerfen"].some((a) => darf(a as SocialAktion));

  return (
    <section className="mara-karte" aria-labelledby="so-was-jetzt">
      <div className="mara-kopfzeile">
        <div>
          <h3 id="so-was-jetzt">Was jetzt?</h3>
          <p className="mara-satz">{SOCIAL_STATUS_INFO[post.status].erklaerung}</p>
        </div>
      </div>
      {nichts ? <p className="mara-satz mara-still">In diesem Status gibt es nichts mehr zu tun.</p> : (
        <div className="so-aktionen" style={{ marginTop: 12 }} data-so-aktionen>
          {darf("freigeben") && (
            <button type="button" className="mara-knopf haupt" data-so-knopf="freigeben" disabled={!!busy || !!sperreFrei || rot}
              title={sperreFrei || (rot ? "Der Wort-Check ist rot." : "Geprüft — darf zur Planzeit veröffentlicht werden.")}
              onClick={() => void tun("freigeben", { version: post.version }, "aktion")}>
              {busy === "freigeben" ? "Gebe frei …" : "Freigeben"}
            </button>
          )}
          {darf("freigeben") && rot && ich.darfTrotzdem && (
            <button type="button" className="mara-knopf warn" aria-expanded={offen === "trotzdem"} disabled={!!busy} onClick={() => auf("trotzdem")}>Trotzdem freigeben …</button>
          )}
          {darf("veroeffentlicht") && (
            <button type="button" className={`mara-knopf${post.status === "veroeffentlicht" ? "" : " haupt"}`} data-so-knopf="veroeffentlicht" aria-expanded={offen === "veroeffentlicht"} disabled={!!busy || !offeneKanaele.length}
              title={offeneKanaele.length ? "Link zum Beitrag je Kanal eintragen — Datum und Uhrzeit setzt das System." : "Alle Kanäle sind schon gemeldet."}
              onClick={() => auf("veroeffentlicht")}>
              {post.status === "veroeffentlicht" ? "Weiteren Kanal melden …" : "Als veröffentlicht melden …"}
            </button>
          )}
          {darf("verschieben") && (
            <button type="button" className="mara-knopf" data-so-knopf="verschieben" aria-expanded={offen === "verschieben"} disabled={!!busy} onClick={() => auf("verschieben")}>Verschieben …</button>
          )}
          {darf("zurueck") && (
            <button type="button" className="mara-knopf" data-so-knopf="zurueck" aria-expanded={offen === "zurueck"} disabled={!!busy} onClick={() => auf("zurueck")}>Zurück an Claude …</button>
          )}
          {darf("verwerfen") && (
            <button type="button" className="mara-knopf warn" data-so-knopf="verwerfen" aria-expanded={offen === "verwerfen"} disabled={!!busy} onClick={() => auf("verwerfen")}>Verwerfen …</button>
          )}
        </div>
      )}

      {darf("freigeben") && (sperreFrei || rot) && (
        <p className="mara-hinweis krit" style={{ marginTop: 10 }}>
          <span className="mara-punkt krit" />
          <span>{sperreFrei || "Der Wort-Check ist rot — Freigeben ist gesperrt."}
            {!ich.darfTrotzdem ? " „Trotzdem freigeben“ darf nur der Inhaber, mit Grund. Sonst: „Zurück an Claude“ mit der Stelle." : ""}</span>
        </p>
      )}
      {roteFelder && roteFelder.length > 0 && (
        <div className="so-pflicht krit so-wort"><b>Der Server hat diese Stellen gefunden:</b>
          <ul>{roteFelder.flatMap((f) => f.treffer.map((t, i) => <li key={`${f.feld}-${i}`}>{f.titel}: „{t.treffer}“<small>{t.hinweis}</small></li>))}</ul>
        </div>
      )}

      {offen === "trotzdem" && (
        <Pflicht ton="warn" titel="Trotzdem freigeben — nur Inhaber, wird protokolliert">
          <textarea className="mara-eingabe" value={grund} onChange={(e) => setGrund(e.target.value)} aria-label="Grund für die Freigabe trotz rotem Wort-Check"
            placeholder="Warum darf der Post trotz rotem Wort-Check raus? (z. B. „Zitat aus dem Gesetzestext, keine Zusage“)" />
          <GrundZaehler n={grund.trim().length} />
          <div className="mara-reihe">
            <button type="button" className="mara-knopf haupt" disabled={!grundOk || !!busy}
              onClick={async () => { if (await tun("freigeben", { version: post.version, trotzdem: true, grund: grund.trim() }, "aktion")) zu(); }}>Trotzdem freigeben</button>
            <button type="button" className="mara-knopf text" onClick={zu}>Abbrechen</button>
          </div>
        </Pflicht>
      )}
      {offen === "zurueck" && (
        <Pflicht titel="Zurück an Claude — was soll anders sein?">
          <textarea className="mara-eingabe" value={grund} onChange={(e) => setGrund(e.target.value)} aria-label="Was soll anders sein"
            placeholder="z. B. „Folie 3: Zahl belegen oder streichen; Caption kürzer, ohne Emoji am Anfang.“" />
          <GrundZaehler n={grund.trim().length} />
          <p className="mara-still mara-klein">Der Post steht dann als Entwurf mit deiner Notiz im Studio (Plan: „Liegt bei Claude“, Filter „Entwurf“). Claude liest das noch nicht selbst — sag Claude in der Social-Sitzung Bescheid. Die nächste Fassung kommt wieder zur Freigabe.</p>
          <div className="mara-reihe">
            <button type="button" className="mara-knopf haupt" disabled={!grundOk || !!busy}
              onClick={async () => { if (await tun("zurueck", { version: post.version, notiz: grund.trim() }, "aktion")) zu(); }}>An Claude zurückgeben</button>
            <button type="button" className="mara-knopf text" onClick={zu}>Abbrechen</button>
          </div>
        </Pflicht>
      )}
      {offen === "verschieben" && (
        <Pflicht titel="Verschieben">
          <div className="mara-reihe">
            <input type="date" className="mara-eingabe" value={datum} onChange={(e) => setDatum(e.target.value)} aria-label="Neues Datum" />
            <input type="time" className="mara-eingabe" value={zeit} onChange={(e) => setZeit(e.target.value)} aria-label="Neue Uhrzeit (leer = ohne Uhrzeit)" step={300} />
            {zeit && <button type="button" className="mara-knopf text" onClick={() => setZeit("")}>ohne Uhrzeit</button>}
          </div>
          <p className="mara-still mara-klein">Berliner Zeit. Ohne Uhrzeit steht der Post als Tagesaufgabe im Plan.</p>
          <div className="mara-reihe">
            <button type="button" className="mara-knopf haupt" disabled={!zeitOk || !!busy || (datum === post.plan_datum && (zeit || null) === (post.plan_zeit || null))}
              onClick={async () => { if (await tun("verschieben", { version: post.version, datum, zeit: zeit || null }, "aktion")) zu(); }}>Verschieben</button>
            <button type="button" className="mara-knopf text" onClick={zu}>Abbrechen</button>
          </div>
        </Pflicht>
      )}
      {offen === "veroeffentlicht" && (
        <Pflicht titel="Als veröffentlicht melden — Link zum Beitrag je Kanal">
          <div className="so-permalink">
            {offeneKanaele.map((k) => {
              const fehlt = pflichtFehlt(k);
              const fehler = linkFehler(k);
              return (
                <div key={k} className="mara-feld">
                  <label htmlFor={`so-link-${k}`}><KanalKuerzel k={k} />{KANAL_INFO[k].titel}</label>
                  <input id={`so-link-${k}`} className="mara-eingabe" type="url" inputMode="url" autoComplete="off" disabled={fehlt.length > 0}
                    placeholder={fehlt.length ? "Erst den KI-Haken in der Checkliste setzen" : "https://…"} value={links[k] ?? ""}
                    onChange={(e) => setLinks((l) => ({ ...l, [k]: e.target.value }))} aria-invalid={!!fehler} />
                  {fehlt.length > 0 && (
                    <small className="mara-warn-t">Pflicht vorher: {fehlt.map((p) => p.text).join(", ")}.{" "}
                      {/* Abhaken gleich hier — derselbe Haken wie in der Checkliste unten, mit Namen im Verlauf. */}
                      {fehlt.map((p) => (
                        <button key={p.punkt} type="button" className="mara-knopf text" style={{ fontSize: 12 }} disabled={!!busy}
                          onClick={() => void tun("checkliste", { version: post.version, kanal: k, punkt: p.punkt, erledigt: true }, "aktion")}>
                          Ist erledigt — abhaken
                        </button>
                      ))}
                    </small>
                  )}
                  {fehler && <small className="mara-krit-t">{fehler}</small>}
                </div>
              );
            })}
          </div>
          <p className="mara-still mara-klein">Datum und Uhrzeit setzt das System. Kanäle ohne Link bleiben offen und lassen sich später melden.</p>
          <p className="mara-hinweis warn"><span className="mara-punkt warn" /><span>Link vorher prüfen (am besten in der App „Link kopieren“) — er lässt sich danach hier noch nicht ändern.</span></p>
          <div className="mara-reihe">
            <button type="button" className="mara-knopf haupt" disabled={!meldenOk || !!busy}
              onClick={async () => { if (await tun("veroeffentlicht", { version: post.version, meldungen }, "aktion")) { setLinks({}); zu(); } }}>
              {meldungen.length > 1 ? `${meldungen.length} Kanäle melden` : "Als veröffentlicht melden"}
            </button>
            <button type="button" className="mara-knopf text" onClick={zu}>Abbrechen</button>
          </div>
        </Pflicht>
      )}
      {offen === "verwerfen" && (
        <Pflicht ton="krit" titel="Verwerfen — der Post wird nicht veröffentlicht">
          <textarea className="mara-eingabe" value={grund} onChange={(e) => setGrund(e.target.value)} aria-label="Grund für das Verwerfen"
            placeholder="Warum fliegt der Post raus? (z. B. „doppelt zu Post 05“, „Thema passt nicht mehr“)" />
          <GrundZaehler n={grund.trim().length} />
          <div className="mara-reihe">
            <button type="button" className="mara-knopf warn" disabled={!grundOk || !!busy}
              onClick={async () => { if (await tun("verwerfen", { version: post.version, grund: grund.trim() }, "aktion")) zu(); }}>Endgültig verwerfen</button>
            <button type="button" className="mara-knopf text" onClick={zu}>Abbrechen</button>
          </div>
        </Pflicht>
      )}
    </section>
  );
}

function Pflicht({ titel, ton, children }: { titel: string; ton?: "warn" | "krit"; children: ReactNode }) {
  return (
    <div className={`so-pflicht${ton ? ` ${ton}` : ""}`} role="group" aria-label={titel} style={{ marginTop: 12 }}>
      <b style={{ fontWeight: 400, color: "var(--m-text)" }}>{titel}</b>
      {children}
    </div>
  );
}
function GrundZaehler({ n }: { n: number }) {
  return <span className={`grund${n < GRUND_MIN ? " fehlt" : ""}`}>{n < GRUND_MIN ? `Pflicht: mindestens ${GRUND_MIN} Zeichen (${n}/${GRUND_MIN}).` : "Wird mit deinem Namen im Verlauf gespeichert."}</span>;
}

// ── Wort-Check ─────────────────────────────────────────────────────────────
function WortCheck({ post }: { post: SocialPostDetail }) {
  const w = post.wortcheck;
  if (!w) return null;
  const n = wortTrefferZahl(w);
  const ausn = w.felder.filter((f) => f.ausnahmen_genutzt.length);
  const titel = w.ergebnis === "rot" ? `Wort-Check rot · ${zahl(n)} ${n === 1 ? "Stelle" : "Stellen"}` : w.ergebnis === "gruen_mit_ausnahmen" ? "Wort-Check grün mit Ausnahme" : "Wort-Check grün";
  return (
    <section className="mara-karte so-wort" aria-label="Wort-Check" data-so-wortcheck>
      <div className="mara-reihe">
        <span className={`mara-pille ${w.ergebnis === "rot" ? "krit" : "gut"}`}>{titel}</span>
        <span className="mara-still mara-klein">geprüft {tagZeitBerlin(w.geprueft_am)} · dieselben Regeln wie im Office (Hauswand + Global)</span>
      </div>
      {w.felder.filter((f) => f.treffer.length).length > 0 && (
        <ul>{w.felder.flatMap((f) => f.treffer.map((t, i) => <li key={`${f.feld}-${i}`}>{f.titel}: „{t.treffer}“<small>{t.hinweis}</small></li>))}</ul>
      )}
      {ausn.length > 0 && (
        <p className="mara-satz mara-still">Ausnahme aus der festen Liste: {ausn.map((f) => `${f.titel} – ${f.ausnahmen_genutzt.map((s) => SOCIAL_AUSNAHMEN.find((a) => a.schluessel === s)?.titel ?? s).join(", ")}`).join("; ")}.</p>
      )}
      {w.ausnahmen_unbekannt.length > 0 && (
        <p className="mara-hinweis warn"><span className="mara-punkt warn" /><span>Im Manifest stehen Ausnahmen, die nicht auf der festen Liste stehen — nicht angewandt: {w.ausnahmen_unbekannt.join(" · ")}</span></p>
      )}
      {w.abweichung_zum_manifest && (
        <p className="mara-hinweis warn"><span className="mara-punkt warn" /><span>Claudes Manifest meldet „{w.manifest?.ergebnis ?? "—"}“ — die Prüfung hier kommt zu einem anderen Ergebnis. Es gilt die Prüfung hier.</span></p>
      )}
    </section>
  );
}

// ── Texte mit Kopieren und Zeichenzählung ─────────────────────────────────
function Texte({ post }: { post: SocialPostDetail }) {
  const captionStaende = post.zeichen.filter((z) => z.feld === "caption");
  const kommentarStaende = post.zeichen.filter((z) => z.feld === "erster_kommentar");
  return (
    <section className="mara-karte" aria-labelledby="so-texte" data-so-texte>
      <h3 id="so-texte" style={{ marginBottom: 12 }}>Texte</h3>
      <TextFeld titel="Caption" text={post.caption} extra={<TeilenKnopf post={post} />} zaehler={
        <>{captionStaende.map((z) => <span key={z.kanal} className={z.ueber ? "ueber" : z.zeichen > z.max * 0.9 ? "knapp" : ""}>{KANAL_INFO[z.kanal].kurz} {zahl(z.zeichen)} / {zahl(z.max)}</span>)}</>
      } />
      <TextFeld titel="Hashtags" text={post.hashtags.join(" ")} zaehler={<HashtagZaehler post={post} />} />
      {post.erster_kommentar && (
        <TextFeld titel="Erster Kommentar" text={post.erster_kommentar} zaehler={
          <>{kommentarStaende.map((z) => <span key={z.kanal} className={z.ueber ? "ueber" : ""}>{KANAL_INFO[z.kanal].kurz} {zahl(z.zeichen)} / {zahl(z.max)}</span>)}</>
        } />
      )}
      <TextFeld titel="Alt-Text" text={post.alt_text ?? ""} leer="Kein Alt-Text im Manifest — für Reels trägt Instagram keinen ein." zaehler={<span>{zahl(zeichenZaehlen(post.alt_text))} Zeichen</span>} />
      {post.link && <TextFeld titel="Link" text={post.link} zaehler={<span>{post.kanaele.some((k) => k.startsWith("linkedin")) ? "LinkedIn: in den ersten Kommentar" : "Instagram: Link in der Bio"}</span>} />}
      {post.bildtexte.length > 0 && (
        <details className="mara-klappe">
          <summary>Text auf den Folien ({zahl(post.bildtexte.length)}) — für Prüfung und Alt-Text</summary>
          <ol className="so-bildtexte">{post.bildtexte.map((t, i) => <li key={i}><span>Folie {i + 1}</span>{t}</li>)}</ol>
        </details>
      )}
    </section>
  );
}

/** Hashtag-Zähler in einzelnen Stücken, die umbrechen dürfen (390 px). Der Satz zur Caption stimmt immer. */
function HashtagZaehler({ post }: { post: SocialPostDetail }) {
  const n = post.hashtags.length;
  const ig = post.kanaele.includes("instagram");
  const caption = (post.caption ?? "").toLowerCase();
  const fehlen = post.hashtags.filter((h) => !caption.includes((h.startsWith("#") ? h : `#${h}`).toLowerCase()));
  return (
    <>
      <span className={n > IG_HASHTAGS_MAX && ig ? "ueber" : ""}>{zahl(n)} {n === 1 ? "Hashtag" : "Hashtags"}</span>
      {ig && <span>Instagram höchstens {IG_HASHTAGS_MAX}</span>}
      {n > 0 && (fehlen.length === 0
        ? <span>stehen schon in der Caption</span>
        : <span className="knapp">{fehlen.length === n ? "noch nicht in der Caption — mitkopieren" : `${zahl(fehlen.length)} noch nicht in der Caption — mitkopieren`}</span>)}
    </>
  );
}

function TextFeld({ titel, text, zaehler, leer, extra }: { titel: string; text: string; zaehler?: ReactNode; leer?: string; extra?: ReactNode }) {
  const [kopiert, setKopiert] = useState(false);
  useEffect(() => { if (!kopiert) return; const t = window.setTimeout(() => setKopiert(false), 2200); return () => window.clearTimeout(t); }, [kopiert]);
  const hat = !!text.trim();
  return (
    <div className="so-text" data-so-feld={titel}>
      <div className="so-text-kopf">
        <span className="mara-etikett">{titel}</span>
        {extra}
        {hat && (
          <button type="button" className="mara-knopf klein" aria-live="polite" onClick={async () => setKopiert(await kopieren(text))}>
            {kopiert ? "Kopiert ✓" : "Kopieren"}
          </button>
        )}
      </div>
      <pre className={hat ? "" : "leer"}>{hat ? text : leer ?? "—"}</pre>
      {zaehler && <div className="so-zaehl">{zaehler}</div>}
    </div>
  );
}

// ── Dateien: einzeln oder als ZIP ─────────────────────────────────────────
const ROLLE_TITEL: Record<string, string> = { bild: "Bild", video: "Video", cover: "Titelbild", dokument: "Dokument", story: "Story" };
function Dateien({ post }: { post: SocialPostDetail }) {
  const liste = useMemo(() => [...post.dateien].sort((a, b) => a.pos - b.pos), [post.dateien]);
  const summe = liste.reduce((n, x) => n + (x.bytes || 0), 0);
  return (
    <section className="mara-karte" aria-labelledby="so-dateien" data-so-dateien>
      <div className="mara-kopfzeile">
        <div>
          <h3 id="so-dateien">Dateien</h3>
          <p className="mara-satz mara-still">{zahl(liste.length)} {liste.length === 1 ? "Datei" : "Dateien"} · {groesse(summe)} · in Upload-Reihenfolge</p>
        </div>
        {liste.length > 0 && (
          <div className="so-teilen">
            <TeilenKnopf post={post} />
            <a className="mara-knopf" href={post.zip_url} download data-so-zip>Alle als ZIP</a>
          </div>
        )}
      </div>
      {liste.length > 0 ? (
        <ul className="so-dateien" style={{ marginTop: 10 }}>
          {liste.map((x) => (
            <li key={x.id}>
              <span className="mini">{x.mime.startsWith("image/") ? <img src={x.url} alt="" loading="lazy" decoding="async" /> : null}</span>
              <span className="name">{x.download_name}
                <small>{ROLLE_TITEL[x.rolle] ?? x.rolle} · {groesse(x.bytes)}{x.breite && x.hoehe ? ` · ${x.breite}×${x.hoehe}` : ""}{x.sekunden ? ` · ${String(x.sekunden).replace(".", ",")} s` : ""}</small>
              </span>
              <a className="mara-knopf klein" href={x.download_url} download={x.download_name} aria-label={`${x.download_name} laden`}>Laden</a>
            </li>
          ))}
        </ul>
      ) : <p className="mara-satz mara-still">Dieser Post hat keine Dateien.</p>}
    </section>
  );
}

// ── In Fotos sichern (Handy) ───────────────────────────────────────────────
/**
 * Teilen-Blatt mit den Dateien in Upload-Reihenfolge: Karussell = alle Folien,
 * Reel = Video + Titelbild. Dort „Bilder sichern“ / „Video sichern“ → Fotos, dann
 * in Instagram auswählen. Nur auf Touch-Geräten mit Datei-Teilen; sonst bleibt
 * Download und ZIP. Safari verlangt das Teilen direkt nach dem Tippen — dauert das
 * Laden zu lange, wird der Knopf zu „Jetzt in Fotos sichern“ (zweites Tippen,
 * die Dateien liegen dann schon bereit).
 */
function TeilenKnopf({ post }: { post: SocialPostDetail }) {
  const [geht] = useState(kannDateienTeilen);
  const [stand, setStand] = useState<"leer" | "laedt" | "bereit" | "fehler">("leer");
  const [fehler, setFehler] = useState<string | null>(null);
  const dateien = useRef<File[] | null>(null);
  const auswahl = useMemo(() => {
    const sortiert = [...post.dateien].sort((a, b) => a.pos - b.pos);
    return post.format === "reel"
      ? sortiert.filter((x) => x.rolle === "video" || x.rolle === "cover")
      : sortiert.filter((x) => x.rolle === "bild" || x.rolle === "story" || x.rolle === "cover");
  }, [post.dateien, post.format]);
  if (!geht || !auswahl.length) return null;
  const teilen = async (f: File[]) => {
    try {
      await navigator.share({ files: f, title: post.titel });
      setStand("leer"); // geteilt — die Dateien bleiben geladen, ein weiteres Tippen teilt sofort
    } catch (e: any) {
      if (e?.name === "AbortError") { setStand("leer"); return; } // selbst abgebrochen
      // Die Tipp-Aktivierung ist während des Ladens abgelaufen → beim zweiten Tippen liegen die Dateien bereit.
      if (e?.name === "NotAllowedError") { setStand("bereit"); return; }
      setFehler("Teilen ging nicht — bitte „Laden“ bzw. „Alle als ZIP“ nutzen."); setStand("fehler");
    }
  };
  const klick = async () => {
    setFehler(null);
    if (dateien.current) return teilen(dateien.current);
    setStand("laedt");
    try {
      dateien.current = await dateienHolen(auswahl.map((x) => ({ url: x.url, name: x.download_name, mime: x.mime })));
      if (!navigator.canShare({ files: dateien.current })) { setFehler("Dieses Gerät kann diese Dateien nicht teilen — bitte „Laden“ nutzen."); setStand("fehler"); return; }
      await teilen(dateien.current);
    } catch (e: any) { setFehler(e?.message || "Laden ging nicht."); setStand("fehler"); }
  };
  const text = stand === "laedt" ? `Lade ${auswahl.length} ${auswahl.length === 1 ? "Datei" : "Dateien"} …`
    : stand === "bereit" ? "Jetzt in Fotos sichern" : `In Fotos sichern${auswahl.length > 1 ? ` (${auswahl.length})` : ""}`;
  return (
    <>
      <button type="button" className="mara-knopf klein haupt" disabled={stand === "laedt"} onClick={() => void klick()} data-so-teilen
        title="Öffnet das Teilen-Blatt: dort „Bilder sichern“ bzw. „Video sichern“ — dann in Instagram aus Fotos wählen.">{text}</button>
      {fehler && <small className="mara-krit-t" role="alert">{fehler}</small>}
    </>
  );
}

// ── Checkliste je Kanal und KI-Kennzeichnung ──────────────────────────────
function Checkliste({ post, ich, busy, tun }: { post: SocialPostDetail; ich: SocialIch; busy: string | null; tun: Tun }) {
  const [kiAuf, setKiAuf] = useState(false);
  // Der Haken folgt dem Finger sofort; bis der Server antwortet, gilt der gewünschte Stand.
  const [schwebend, setSchwebend] = useState<Record<string, boolean>>({});
  const haken = async (k: SocialKanal, punkt: string, erledigt: boolean) => {
    const sch = `${k}:${punkt}`;
    setSchwebend((x) => ({ ...x, [sch]: erledigt }));
    await tun("checkliste", { version: post.version, kanal: k, punkt, erledigt }, "check");
    setSchwebend((x) => { const n = { ...x }; delete n[sch]; return n; });
  };
  const [kiNoetig, setKiNoetig] = useState(post.ki_noetig);
  const [kiGrund, setKiGrund] = useState(post.ki_grund ?? "");
  useEffect(() => { setKiNoetig(post.ki_noetig); setKiGrund(post.ki_grund ?? ""); }, [post.ki_noetig, post.ki_grund]);
  const darfHaken = post.erlaubte_aktionen.includes("checkliste");
  const darfKi = post.erlaubte_aktionen.includes("ki-haken");
  const kanaele = post.kanaele.filter((k) => (post.checkliste_soll[k] ?? []).length > 0);
  // Senken (nötig → nicht nötig) nur Inhaber, mit Grund ≥ GRUND_MIN (Prüfung 06.10.2026). Der Server prüft dasselbe.
  const senken = post.ki_noetig && !kiNoetig;
  const darfSenken = ich.stufe === "inhaber";
  const kiGrundOk = senken ? darfSenken && kiGrund.trim().length >= GRUND_MIN : !kiNoetig || kiGrund.trim().length >= 3;
  const freigabeFaellt = kiNoetig !== post.ki_noetig && (post.status === "freigegeben" || post.status === "eingeplant");

  return (
    <section className="mara-karte so-check" aria-labelledby="so-check" data-so-checkliste>
      <div>
        <h3 id="so-check">Checkliste beim Posten</h3>
        <p className="mara-satz mara-still">Abhaken, während du in der App postest. Pflichtpunkte sperren „Als veröffentlicht melden“.</p>
      </div>

      <div className="so-pflicht" data-so-ki>
        <div className="mara-reihe" style={{ justifyContent: "space-between" }}>
          <span><span className="mara-etikett">KI-Kennzeichnung</span><br />
            <span style={{ color: "var(--m-text)" }}>{post.ki_noetig ? "Nötig" : "Nicht nötig"}</span>
            {post.ki_grund ? <span className="mara-still"> — {post.ki_grund}</span> : null}
          </span>
          {darfKi && <button type="button" className="mara-knopf klein" aria-expanded={kiAuf} onClick={() => setKiAuf((a) => !a)}>Ändern</button>}
        </div>
        {post.ki_noetig && <p className="mara-still mara-klein">Art. 50 KI-VO und Meta-Regel: Beim Hochladen „KI-Info“ einschalten. Der Haken ist je Kanal Pflicht.</p>}
        {kiAuf && (
          <>
            <div className="mara-ansicht" role="group" aria-label="KI-Kennzeichnung nötig?" style={{ margin: 0 }}>
              <button type="button" aria-pressed={kiNoetig} onClick={() => setKiNoetig(true)}>Ja, nötig</button>
              <button type="button" aria-pressed={!kiNoetig} onClick={() => setKiNoetig(false)} disabled={post.ki_noetig && !darfSenken}
                title={post.ki_noetig && !darfSenken ? "Abschalten darf nur der Inhaber — mit Grund." : undefined}>Nein</button>
            </div>
            {post.ki_noetig && !darfSenken && <p className="mara-still mara-klein">Die KI-Kennzeichnung abschalten darf nur der Inhaber, mit Grund.</p>}
            {senken && darfSenken && <GrundZaehler n={kiGrund.trim().length} />}
            {freigabeFaellt && <p className="mara-hinweis warn"><span className="mara-punkt warn" /><span>Der Post ist schon „{SOCIAL_STATUS_INFO[post.status].titel}“ — mit der Änderung geht er zurück zur Freigabe.</span></p>}
            <input className="mara-eingabe" value={kiGrund} onChange={(e) => setKiGrund(e.target.value)} aria-label="Grund der KI-Kennzeichnung"
              placeholder={kiNoetig ? "Grund (Pflicht), z. B. „Video aus Higgsfield“" : senken ? `Grund (Pflicht, mindestens ${GRUND_MIN} Zeichen), z. B. „echte Fotos, Text von Hand“` : "Grund, z. B. „echte Fotos, Text von Hand“"} />
            <div className="mara-reihe">
              <button type="button" className="mara-knopf haupt" disabled={!!busy || !kiGrundOk || (kiNoetig === post.ki_noetig && kiGrund.trim() === (post.ki_grund ?? ""))}
                onClick={async () => { if (await tun("ki-haken", { version: post.version, noetig: kiNoetig, grund: kiGrund.trim() }, "check")) setKiAuf(false); }}>Speichern</button>
              <button type="button" className="mara-knopf text" onClick={() => setKiAuf(false)}>Abbrechen</button>
            </div>
          </>
        )}
      </div>

      {kanaele.length === 0 && <p className="mara-satz mara-still">Für diese Kanäle gibt es keine Punkte zum Abhaken.</p>}
      {kanaele.map((k) => (
        <fieldset key={k} disabled={!darfHaken || !!busy}>
          <legend><KanalKuerzel k={k} />{KANAL_INFO[k].titel}{post.veroeffentlicht?.[k] ? <span className="mara-pille gut">gemeldet</span> : null}</legend>
          {(post.checkliste_soll[k] ?? []).map((p) => {
            const an = schwebend[`${k}:${p.punkt}`] ?? !!post.checkliste?.[k]?.[p.punkt];
            const wer = post.checkliste?.[k]?.[p.punkt];
            return (
              <label key={p.punkt} className={`${p.pflicht ? "pflicht" : ""}${an ? " erledigt" : ""}`} data-so-punkt={`${k}:${p.punkt}`}>
                <input type="checkbox" checked={an}
                  onChange={(e) => void haken(k, p.punkt, e.target.checked)} />
                <span>{p.text}{p.pflicht && <span className="pflicht-marke">{p.punkt === KI_PUNKT ? "Pflicht (KI)" : "Pflicht"}</span>}
                  {wer && <small className="mara-still" style={{ display: "block", fontSize: 12 }}>{wer.von}, {tagZeitBerlin(wer.am)}</small>}</span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </section>
  );
}

// ── Verlauf ────────────────────────────────────────────────────────────────
const ART_TITEL: Record<string, string> = {
  import_neu: "Von Claude eingespielt", neue_version: "Neue Fassung von Claude", freigegeben: "Freigegeben", freigabe_trotz_rot: "Freigegeben trotz rotem Wort-Check",
  zurueck_an_claude: "Zurück an Claude", verschoben: "Verschoben", veroeffentlicht: "Als veröffentlicht gemeldet", verworfen: "Verworfen",
  checkliste: "Checkliste", ki_haken: "KI-Haken", ki_kennzeichnung: "KI-Kennzeichnung geändert", ki_konflikt: "KI-Kennzeichnung: Studio und meta.json weichen ab",
  bearbeitet: "Im Studio bearbeitet", wortcheck: "Wort-Check neu", eingeplant: "Eingeplant",
  plan_aus_import: "Termin aus dem Import", kennzahlen: "Kennzahlen",
};
function Verlauf({ post }: { post: SocialPostDetail }) {
  if (!post.verlauf?.length) return null;
  return (
    <details className="mara-karte mara-klappe" style={{ marginTop: 0, paddingTop: 14 }}>
      <summary>Verlauf ({zahl(post.verlauf.length)}) — wer, wann, was</summary>
      <ul className="so-verlauf">
        {post.verlauf.map((v) => (
          <li key={v.id}><span>{tagZeitBerlin(v.am)}</span>
            <span>{ART_TITEL[v.art] ?? v.art} · {v.von}{v.fassung ? ` · Fassung ${v.fassung}` : ""}{v.grund ? ` — „${v.grund}“` : ""}</span></li>
        ))}
      </ul>
    </details>
  );
}
