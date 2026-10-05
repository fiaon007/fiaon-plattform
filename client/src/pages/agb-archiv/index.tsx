// ═══════════════════════════════════════════════════════════════════════════
// /agb/:fassung — DAS ARCHIV DER AGB (05.10.2026, E-283)
//
// ── WARUM ─────────────────────────────────────────────────────────────────
// Bis heute stand unter fiaon.com/agb nur die jeweils neueste Fassung. Der
// Vertrag des neuen Antrags (§ 13 Abs. 3, Anlage 3) und die Bestätigungsmail
// versprachen aber die Fassung „vom 26. September 2026 … abrufbar und
// speicherbar unter fiaon.com/agb“ — mit der neuen Fassung vom 05.10.2026 wäre
// dieser Text verschwunden, ebenso die Fassungen vom 03.09. und 04.07., auf die
// § 6 Abs. 8 („gelten … fort“) verweist. Vom 03.09.-Text gab es nur noch § 3
// als Ausklappblock.
//
// ── WIE ───────────────────────────────────────────────────────────────────
// · Die aktuelle Fassung (AGB_FASSUNG) zeigt die aktuelle Seite — dieselbe
//   Komponente wie /agb, kein zweiter Text.
// · Jede frühere Fassung (AGB_FRUEHERE_FASSUNGEN) ist eine eigene Datei mit
//   dem Text WÖRTLICH aus Git, nachgeladen erst beim Aufruf.
// · Eine Fassung, die es nicht gibt, bekommt einen Hinweis mit Link auf /agb
//   — keinen weißen Bildschirm. Der Server antwortet dort mit 404 und noindex
//   (seiteUnbekannt in server/lib/fiaon-seiten-seo.ts); die bekannten
//   Fassungen stehen mit noindex in shared/fiaon-seo-seiten.ts und kommen mit
//   200.
// ═══════════════════════════════════════════════════════════════════════════
import { lazy, useEffect, type ComponentType, type LazyExoticComponent } from "react";
import { Link, useParams } from "wouter";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import AGBPage from "@/pages/agb";
import { AGB_FASSUNG, type AGB_FRUEHERE_FASSUNGEN } from "@shared/fiaon-vertrag-paket";
import { FassungenListe } from "./ArchivKopf";

// Der Typ verlangt für JEDE Fassung aus AGB_FRUEHERE_FASSUNGEN eine Seite — wer dort eine
// einträgt und die Datei vergisst, bekommt einen Typfehler statt eines toten Links.
const ARCHIV: Record<(typeof AGB_FRUEHERE_FASSUNGEN)[number], LazyExoticComponent<ComponentType>> = {
  "2026-09-26": lazy(() => import("./fassung-2026-09-26")),
  "2026-09-03": lazy(() => import("./fassung-2026-09-03")),
  "2026-07-04": lazy(() => import("./fassung-2026-07-04")),
  "2026-04-12": lazy(() => import("./fassung-2026-04-12")),
};

function FassungUnbekannt({ fassung }: { fassung: string }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <GlassNav />
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-24">
        <div className="fiaon-glass-panel rounded-2xl p-8" data-agb-archiv="unbekannt">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Diese Fassung der AGB gibt es nicht</h1>
          <p className="text-gray-700 leading-relaxed mb-4">
            Unter fiaon.com/agb/{fassung.slice(0, 40)} steht keine Fassung unserer Allgemeinen Geschäftsbedingungen. Vielleicht ist die Adresse unvollständig oder vertippt.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <Link href="/agb" className="text-blue-600 hover:text-blue-700 underline font-semibold">Zur aktuellen Fassung: fiaon.com/agb</Link>
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Frühere Fassungen: <FassungenListe />
          </p>
        </div>
      </div>
      <PremiumFooter />
    </div>
  );
}

export default function AgbFassungPage() {
  const { fassung = "" } = useParams<{ fassung: string }>();
  const f = fassung.trim();
  if (f === AGB_FASSUNG) return <AGBPage />;
  // Nur eigene Schlüssel: /agb/constructor darf nicht Object.prototype.constructor als Seite rendern.
  const Archiv = Object.prototype.hasOwnProperty.call(ARCHIV, f) ? (ARCHIV as Record<string, LazyExoticComponent<ComponentType>>)[f] : null;
  return Archiv ? <Archiv /> : <FassungUnbekannt fassung={f} />;
}
