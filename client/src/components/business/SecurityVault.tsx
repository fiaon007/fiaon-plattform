import { useState, useRef, useEffect } from "react";

export default function SecurityVault() {
  const [hoveredFaq, setHoveredFaq] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const faqs = [
    {
      question: "Wirkt sich die Prüfung negativ auf den Bonitäts-Score meines Unternehmens aus?",
      answer: "Absolut nein. Unsere KI-Profilanalyse und die Limit-Engine arbeiten zu 100 % isoliert. Es werden keine harten Schufa- oder Creditreform-Meldungen generiert. Dein aktueller Score bleibt völlig unangetastet, während wir im Hintergrund deine perfekte Limit-Infrastruktur vorbereiten.",
      icon: "shield"
    },
    {
      question: "Ist FIAON eine Bank oder ein Finanzvermittler?",
      answer: "Nein. Und genau das ist dein größter Vorteil. FIAON ist eine unabhängige Software-as-a-Service (SaaS) und Credit-Building-Engine. Wir nehmen keine Provisionen von Banken und verkaufen dir keine versteckten Finanzprodukte. Wir sind der neutrale Architekt, der deine Systeme so optimiert, dass die Banken dir freiwillig Höchstlimits gewähren.",
      icon: "liberty"
    },
    {
      question: "Wo liegen meine Unternehmensdaten und wer hat Zugriff?",
      answer: "Alle Daten werden ausschließlich auf hochsicheren, DSGVO-konformen Servern innerhalb der Europäischen Union (EU-Hosting) verarbeitet und mittels AES-256-Verschlüsselung auf Banken-Niveau geschützt. Mit unserem One-Click-Privacy-Button kannst du dein Profil und alle verknüpften Daten jederzeit mit sofortiger Wirkung unwiderruflich löschen.",
      icon: "vault"
    }
  ];

  // Simplified vault visualization with canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame: number;
    let rotation = 0;

    const drawVault = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Determine color based on hovered FAQ
      let primaryColor = "#10b981"; // Default green
      let secondaryColor = "#2563eb"; // Blue
      
      if (hoveredFaq === 0) {
        primaryColor = "#10b981"; // Green for shield
      } else if (hoveredFaq === 1) {
        primaryColor = "#2563eb"; // Blue for liberty
      } else if (hoveredFaq === 2) {
        primaryColor = "#d4af37"; // Gold for vault
      }

      // Draw outer ring (green)
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 120, 120, rotation, 0, Math.PI * 2);
      ctx.stroke();

      // Draw middle ring (blue)
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 90, 90, -rotation * 1.5, 0, Math.PI * 2);
      ctx.stroke();

      // Draw inner ring (green)
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 60, 60, rotation * 0.5, 0, Math.PI * 2);
      ctx.stroke();

      // Draw card in center (realistic proportions - BLUE)
      const cardWidth = 140;
      const cardHeight = 88;
      const cardGradient = ctx.createLinearGradient(centerX - cardWidth/2, centerY - cardHeight/2, centerX + cardWidth/2, centerY + cardHeight/2);
      cardGradient.addColorStop(0, "#0b1628");
      cardGradient.addColorStop(0.3, "#1a3560");
      cardGradient.addColorStop(0.5, "#1e4070");
      cardGradient.addColorStop(0.7, "#1a3560");
      cardGradient.addColorStop(1, "#0b1628");
      
      ctx.fillStyle = cardGradient;
      ctx.beginPath();
      ctx.roundRect(centerX - cardWidth/2, centerY - cardHeight/2, cardWidth, cardHeight, 10);
      ctx.fill();

      // Card border (subtle)
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw chip (realistic gold chip)
      const chipGradient = ctx.createLinearGradient(centerX - cardWidth/2 + 15, centerY - cardHeight/2 + 20, centerX - cardWidth/2 + 35, centerY - cardHeight/2 + 35);
      chipGradient.addColorStop(0, "#d4af37");
      chipGradient.addColorStop(0.5, "#f0d875");
      chipGradient.addColorStop(1, "#c9a227");
      
      ctx.fillStyle = chipGradient;
      ctx.beginPath();
      ctx.roundRect(centerX - cardWidth/2 + 15, centerY - cardHeight/2 + 20, 20, 15, 3);
      ctx.fill();

      // Chip lines
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(centerX - cardWidth/2 + 15, centerY - cardHeight/2 + 20 + (i + 1) * 3.5);
        ctx.lineTo(centerX - cardWidth/2 + 35, centerY - cardHeight/2 + 20 + (i + 1) * 3.5);
        ctx.stroke();
      }

      // FIAON logo
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("FIAON", centerX + cardWidth/2 - 15, centerY - cardHeight/2 + 25);

      // Shimmer/glow effect on card
      const shimmerGradient = ctx.createLinearGradient(
        centerX - cardWidth/2 - 50 + Math.sin(rotation * 2) * 100,
        centerY - cardHeight/2,
        centerX + cardWidth/2 + 50 + Math.sin(rotation * 2) * 100,
        centerY + cardHeight/2
      );
      shimmerGradient.addColorStop(0, "rgba(255,255,255,0)");
      shimmerGradient.addColorStop(0.5, "rgba(255,255,255,0.3)");
      shimmerGradient.addColorStop(1, "rgba(255,255,255,0)");
      
      ctx.fillStyle = shimmerGradient;
      ctx.beginPath();
      ctx.roundRect(centerX - cardWidth/2, centerY - cardHeight/2, cardWidth, cardHeight, 10);
      ctx.fill();

      // Realistic lock icon on top
      const lockX = centerX;
      const lockY = centerY;
      const lockScale = 1.2;

      ctx.save();
      ctx.translate(lockX, lockY);
      ctx.scale(lockScale, lockScale);

      // Lock shackle (more realistic with thickness)
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      if (isLocked) {
        // Closed shackle
        ctx.arc(0, -8, 10, Math.PI, 0);
      } else {
        // Open shackle (rotated)
        ctx.save();
        ctx.translate(0, -8);
        ctx.rotate(-0.4);
        ctx.arc(0, 0, 10, Math.PI * 0.6, Math.PI * 1.4);
        ctx.restore();
      }
      ctx.stroke();

      // Shackle highlight
      ctx.strokeStyle = "#f0d875";
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (isLocked) {
        ctx.arc(0, -8, 10, Math.PI, 0);
      } else {
        ctx.save();
        ctx.translate(0, -8);
        ctx.rotate(-0.4);
        ctx.arc(0, 0, 10, Math.PI * 0.6, Math.PI * 1.4);
        ctx.restore();
      }
      ctx.stroke();

      // Lock body (more detailed with 3D effect)
      const lockGradient = ctx.createLinearGradient(-12, 0, 12, 18);
      lockGradient.addColorStop(0, "#b8923a");
      lockGradient.addColorStop(0.3, "#d4af37");
      lockGradient.addColorStop(0.5, "#f0d875");
      lockGradient.addColorStop(0.7, "#d4af37");
      lockGradient.addColorStop(1, "#8b6914");
      
      ctx.fillStyle = lockGradient;
      ctx.beginPath();
      ctx.roundRect(-12, 0, 24, 18, 4);
      ctx.fill();

      // Lock body top highlight
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.roundRect(-10, 2, 20, 6, 2);
      ctx.fill();

      // Lock body shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.roundRect(-10, 12, 20, 4, 2);
      ctx.fill();

      // Keyhole (more detailed)
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.arc(0, 10, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Keyhole slot
      ctx.fillRect(-2, 2, 4, 8);
      
      // Keyhole inner highlight
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.arc(-1, 9, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      rotation += 0.01;
      animationFrame = requestAnimationFrame(drawVault);
    };

    drawVault();
    return () => cancelAnimationFrame(animationFrame);
  }, [hoveredFaq, isLocked]);

  return (
    <section className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-3xl mb-16">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Sicherheit & Compliance</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 text-gray-900">Maximale Kapitalmacht erfordert kompromisslose Sicherheit.</h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">
            Deine Finanzdaten sind das wertvollste Asset deines Unternehmens. Das FIAON-System arbeitet isoliert, schufaneutral und nach den strengsten europäischen Banken- und Datenschutz-Standards. Kein Risiko. Volle Souveränität.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Vault Visualization */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 order-1 lg:order-2">
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="w-full h-auto max-w-[400px] mx-auto cursor-pointer"
              onClick={() => setIsLocked(!isLocked)}
            />
            <div className="mt-6 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">FIAON Cyber Vault</p>
              <p className="text-[13px] text-gray-600">AES-256 Verschlüsselung • EU-Hosting • DSGVO-konform</p>
              <p className="text-[12px] text-gray-400 mt-2">Klicke auf das Schloss zum {isLocked ? "Öffnen" : "Schließen"}</p>
            </div>
          </div>

          {/* FAQs */}
          <div className="space-y-4 order-2 lg:order-1">
            {faqs.map((faq, i) => (
              <div
                key={i}
                onMouseEnter={() => setHoveredFaq(i)}
                onMouseLeave={() => setHoveredFaq(null)}
                className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 ${
                  hoveredFaq === i
                    ? "bg-white border-blue-500 shadow-lg shadow-blue-500/10"
                    : "bg-white border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start gap-4 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    hoveredFaq === i ? "bg-blue-100" : "bg-gray-100"
                  }`}>
                    {faq.icon === "shield" && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hoveredFaq === i ? "#2563eb" : "#64748b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    )}
                    {faq.icon === "liberty" && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hoveredFaq === i ? "#2563eb" : "#64748b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4"/>
                        <path d="M12 8h.01"/>
                      </svg>
                    )}
                    {faq.icon === "vault" && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hoveredFaq === i ? "#2563eb" : "#64748b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[15px] sm:text-[17px] font-semibold text-gray-900 mb-2">{faq.question}</h3>
                    <p className="text-[13px] text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-12 text-center">
          <a href="/business-antrag" className="fiaon-btn-gradient inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-[15px] font-medium text-white shadow-lg shadow-blue-500/20 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5">
            Sicher starten
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    </section>
  );
}
