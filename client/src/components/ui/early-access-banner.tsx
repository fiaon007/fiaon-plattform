import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";

export function EarlyAccessBanner() {
  const bannerText = "ARAS AI® – Early Access Phase  •  Unsere Plattform ist ab sofort live und befindet sich aktuell in der finalen Entwicklungsphase  •  Während dieser Testphase kann es vereinzelt zu kurzfristigen Ausfällen oder Anpassungen kommen  •  Der offizielle Marktstart erfolgt am 01. Januar 2026  •  Wir danken allen Testkunden für ihr wertvolles Feedback und ihre Unterstützung auf dem Weg zum Launch  •  ";

  return (
    <div className="relative w-full h-10 overflow-hidden z-50">
      {/* Background with gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, rgba(0,0,0,0.95) 0%, rgba(15,15,15,0.98) 50%, rgba(0,0,0,0.95) 100%)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(254, 145, 0, 0.2)'
        }}
      >
        {/* Animated gradient overlay */}
        <motion.div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(254, 145, 0, 0.15), transparent)',
            backgroundSize: '200% 100%'
          }}
          animate={{
            backgroundPosition: ['0% 50%', '200% 50%']
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Scrolling text container */}
      <div className="relative h-full flex items-center">
        <motion.div
          className="flex items-center whitespace-nowrap"
          animate={{
            x: ['0%', '-50%']
          }}
          transition={{
            duration: 60,
            repeat: Infinity,
            ease: 'linear'
          }}
          style={{ willChange: 'transform' }}
        >
          {/* Render text twice for seamless loop */}
          {[1, 2].map((iteration) => (
            <div key={iteration} className="flex items-center">
              {bannerText.split('•').map((segment, index) => (
                <div key={`${iteration}-${index}`} className="flex items-center">
                  <span 
                    className="text-sm font-medium tracking-wide px-6"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #FE9100, #e9d7c4)',
                      backgroundSize: '200% 100%',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {segment.trim()}
                  </span>
                  {index < bannerText.split('•').length - 1 && (
                    <div 
                      className="w-1.5 h-1.5 rounded-full mx-2"
                      style={{
                        background: '#FE9100',
                        boxShadow: '0 0 8px rgba(254, 145, 0, 0.6)'
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom glow line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(254, 145, 0, 0.6), transparent)',
          backgroundSize: '200% 100%'
        }}
        animate={{
          backgroundPosition: ['0% 50%', '200% 50%', '0% 50%']
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}