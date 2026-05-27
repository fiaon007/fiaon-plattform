import { useState, useRef, useEffect } from "react";

export default function CaseStudies() {
  const [activeCase, setActiveCase] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cases = [
    {
      title: "Die E-Commerce Brand",
      focus: "Werbebudget-Hebel",
      company: "GmbH im Bereich D2C-Brands (7-stelliger Jahresumsatz)",
      problem: "Hausbank blockierte das Kreditkartenlimit bei 15.000 €. Facebook- und Google-Ads stoppten mitten in der Hauptsaison wegen Limit-Erschöpfung.",
      result: "Einstieg über das Gold-Setup. Innerhalb von 4 Monaten Optimierung des Firmen-Scores und Rotation des Limits auf 120.000 €. Keine gestoppten Werbekampagnen mehr.",
      data: [15, 25, 45, 70, 95, 120]
    },
    {
      title: "Die Performance-Marketing-Agentur",
      focus: "Multi-Karten & Team",
      company: "Skalierende Media-Agentur mit 25 Mitarbeitern",
      problem: "Chaos bei den Mitarbeiter-Ausgaben. Jede Software-Lizenz musste über die eine Karte des Geschäftsführers laufen.",
      result: "Freischaltung des Executive-Setups mit 50.000 € Gesamtlimit und einer automatisierten Multi-Karten-Struktur. Jeder Media Buyer hat heute ein eigenes, gedeckeltes Limit.",
      data: [0, 10, 25, 35, 45, 50]
    },
    {
      title: "Die internationale Handels-Holding",
      focus: "Black-Card Elite",
      company: "Import/Export & Logistik (Internationaler Markt)",
      problem: "Hohe Fremdwährungsgebühren im Ausland und ständige Sicherheits-Sperren bei Zahlungen in Asien/USA.",
      result: "Implementierung der Black-Sovereign-Infrastruktur. Limit: 350.000 €, komplett gebührenfreies internationales Setup und 24/7 Priority-Support bei Banken-Rückfragen.",
      data: [50, 100, 180, 250, 300, 350]
    }
  ];

  // Clean canvas graph visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawGraph = () => {
      const width = canvas.width;
      const height = canvas.height;
      const padding = 50;
      const data = cases[activeCase].data;
      const maxValue = Math.max(...cases.flatMap(c => c.data));

      ctx.clearRect(0, 0, width, height);

      // Draw grid lines (subtle)
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const y = padding + (height - 2 * padding) * (i / 5);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }

      // Draw gradient fill (subtle blue)
      const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
      gradient.addColorStop(0, "rgba(37, 99, 235, 0.15)");
      gradient.addColorStop(1, "rgba(37, 99, 235, 0)");

      ctx.beginPath();
      ctx.moveTo(padding, height - padding);
      data.forEach((value, i) => {
        const x = padding + (width - 2 * padding) * (i / (data.length - 1));
        const y = height - padding - ((height - 2 * padding) * (value / maxValue));
        ctx.lineTo(x, y);
      });
      ctx.lineTo(width - padding, height - padding);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw line (clean blue)
      ctx.beginPath();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      data.forEach((value, i) => {
        const x = padding + (width - 2 * padding) * (i / (data.length - 1));
        const y = height - padding - ((height - 2 * padding) * (value / maxValue));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw points (clean white with blue border)
      data.forEach((value, i) => {
        const x = padding + (width - 2 * padding) * (i / (data.length - 1));
        const y = height - padding - ((height - 2 * padding) * (value / maxValue));
        
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 3;
        ctx.stroke();
      });

      // Draw month labels
      ctx.fillStyle = "#64748b";
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "center";
      data.forEach((value, i) => {
        const x = padding + (width - 2 * padding) * (i / (data.length - 1));
        ctx.fillText(`M${i + 1}`, x, height - padding + 25);
      });
    };

    drawGraph();
  }, [activeCase, cases]);

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-3xl mb-16">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Case Studies</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 text-gray-900">Keine Versprechen. Validierte Limits aus der Praxis.</h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">
            Vom ersten Klick im Antrag bis zur internationalen Millionen-Skalierung. Erfahre, wie führende Digitalmarken, Agenturen und GmbHs das FIAON-System nutzen, um ihre Liquidität unabhängig von traditionellen Banken aufzubauen.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Case Selector */}
          <div className="space-y-4 order-2 lg:order-1">
            {cases.map((c, i) => (
              <div
                key={i}
                onClick={() => setActiveCase(i)}
                className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 ${
                  activeCase === i
                    ? "bg-white border-blue-500 shadow-lg shadow-blue-500/10"
                    : "bg-gray-50 border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-[15px] sm:text-[17px] font-semibold text-gray-900">{c.title}</h3>
                  {activeCase === i && (
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-600">
                      Aktiv
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-semibold text-blue-600 mb-3 uppercase tracking-wider">{c.focus}</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Unternehmen</p>
                    <p className="text-[12px] sm:text-[13px] text-gray-600">{c.company}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Das Problem</p>
                    <p className="text-[12px] sm:text-[13px] text-gray-600">{c.problem}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Das FIAON-Ergebnis</p>
                    <p className="text-[12px] sm:text-[13px] text-gray-600">{c.result}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Graph Visualization */}
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 sm:p-8 order-1 lg:order-2">
            <div className="mb-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Limit-Entwicklung (in 6 Monaten)</p>
              <p className="text-[28px] sm:text-[32px] font-bold text-gray-900">{ (cases[activeCase].data[5] * 1000).toLocaleString()} €</p>
            </div>
            <canvas
              ref={canvasRef}
              width={500}
              height={350}
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-12 text-center">
          <a href="/business-antrag" className="fiaon-btn-gradient inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-[15px] font-medium text-white shadow-lg shadow-blue-500/20 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5">
            Ähnliche Ergebnisse erzielen
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    </section>
  );
}
