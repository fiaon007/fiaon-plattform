// ═══════════════════════════════════════════════════════════════════════════
// /ist-fiaon-serioes · /en/is-fiaon-legit — „Ist FIAON seriös? Die Fakten“ (E-445, 28.10.2026; E-459, 29.10.2026)
//
// 29.10.2026 (E-459) — Justin: „Die ganze Seite muss auf das Business-Konzept umgebaut werden, komplett — auch in
// unserem Apple-Design und alles auf Business.“ Die Seite erscheint darum in der Vorlage der Business-Unterseiten
// (global-seite.tsx → GlobalSeitenAnsicht): Kopf der Business-Welt, „Auf einen Blick“, Inhaltsverzeichnis, Abschnitte,
// Fragen, Gespräch, Apple-Glas und Apple-Bewegung. Text, Fakten und FAQ: shared/fiaon-serioes-seite.ts (dieselben Sätze
// stehen im Vorab-HTML, server/lib/fiaon-global-seo.ts). Die Adressen bleiben — Google kennt sie seit dem 28.10.
// ═══════════════════════════════════════════════════════════════════════════
import { useSprache } from "@/i18n/sprache";
import { GlobalSeitenAnsicht } from "@/pages/site/global-seite";
import { SERIOES_SEITE } from "@shared/fiaon-serioes-seite";

export default function IstFiaonSerioes() {
  const sprache = useSprache();
  return <GlobalSeitenAnsicht s={sprache === "en" ? SERIOES_SEITE.en : SERIOES_SEITE.de} />;
}
