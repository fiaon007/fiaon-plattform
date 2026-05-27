import { useRef, useEffect, useState } from "react";

export default function Engine3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState("10.000");
  const [cardColor, setCardColor] = useState("linear-gradient(135deg,#0b1628,#1a3560,#0b1628)");
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [scrollProgress, setScrollProgress] = useState(0);

  // Particle system
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }> = [];
    const numParticles = 60;

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.3 + 0.15
      });
    }

    let animationFrame: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(p => {
        p.x += p.vx * (1 + scrollProgress * 2);
        p.y += p.vy * (1 + scrollProgress * 2);
        
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(37, 99, 235, ${p.alpha})`;
        ctx.fill();
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, [scrollProgress]);

  // Mouse parallax (subtle only)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 5;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * -5;
      setRotation({ x, y });
    };

    const handleMouseLeave = () => {
      setRotation({ x: 0, y: 0 });
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  // Scroll trigger
  useEffect(() => {
    const handleScroll = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const windowHeight = window.innerHeight;
      const rectTop = rect.top;
      const rectHeight = rect.height;
      
      // Calculate progress based on how much of the component has been scrolled through
      const progress = Math.max(0, Math.min(1, (windowHeight - rectTop) / (windowHeight + rectHeight)));
      setScrollProgress(progress);

      // Update limit based on scroll
      if (progress < 0.33) {
        setLimit("10.000");
        setCardColor("linear-gradient(135deg,#0b1628,#1a3560,#0b1628)");
      } else if (progress < 0.66) {
        setLimit("50.000");
        setCardColor("linear-gradient(135deg,#0b1628,#1a3560,#1e4070)");
      } else {
        setLimit("100.000");
        setCardColor("linear-gradient(135deg,#111,#1a1a1a,#2a2a2a)");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial call
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-[500px] overflow-hidden">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="absolute inset-0 w-full h-full z-0"
      />
      
      {/* 3D Card */}
      <div
        className="absolute inset-0 flex items-center justify-center z-10"
        style={{ perspective: "1000px" }}
      >
        <div
          className="relative w-[400px] h-[252px] rounded-2xl transition-transform duration-100 ease-out"
          style={{
            background: cardColor,
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 48px -8px rgba(0,0,0,0.3)",
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y + scrollProgress * 360}deg)`,
          }}
        >
          {/* Chip */}
          <div className="absolute top-6 left-6 w-10 h-7 rounded" style={{ background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }} />
          
          {/* Logo */}
          <span className="absolute top-6 right-6 text-sm font-semibold tracking-wide" style={{ color: "rgba(255,255,255,0.65)" }}>FIAON</span>
          
          {/* Limit Text */}
          <div className="absolute bottom-6 left-6">
            <div className="text-[8px] uppercase tracking-[0.14em] font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>LIMIT</div>
            <div className="font-mono text-lg font-semibold whitespace-nowrap" style={{ color: "rgba(255,255,255,0.9)" }}>{limit} €</div>
          </div>

          {/* Shimmer effect */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 opacity-30" style={{ background: "linear-gradient(135deg,transparent 40%,rgba(255,255,255,0.3) 50%,transparent 60%)", backgroundSize: "200% 100%", animation: "shimmer 3s ease-in-out infinite" }} />
          </div>
        </div>
      </div>

      {/* Orbiting Nodes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-4 h-4 rounded-full bg-blue-500 opacity-60 animate-pulse" style={{ boxShadow: "0 0 20px rgba(37,99,235,0.6)" }} />
        <div className="absolute top-1/3 right-1/4 w-3 h-3 rounded-full bg-yellow-500 opacity-60 animate-pulse" style={{ boxShadow: "0 0 20px rgba(234,179,8,0.6)", animationDelay: "0.5s" }} />
        <div className="absolute bottom-1/3 left-1/3 w-3 h-3 rounded-full bg-blue-500 opacity-60 animate-pulse" style={{ boxShadow: "0 0 20px rgba(37,99,235,0.6)", animationDelay: "1s" }} />
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
