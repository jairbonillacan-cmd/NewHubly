"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Escalón de retraso (0 a 5) para escalonar elementos hermanos. */
  retraso?: 0 | 1 | 2 | 3 | 4 | 5;
  /** Clase de animación: «hubly-reveal» (subir y aparecer) o «hubly-bars» (barras que crecen). */
  efecto?: "hubly-reveal" | "hubly-bars";
}

/** Marca su contenido como visible al entrar en pantalla; los estilos viven en tokens.css y respetan el movimiento reducido. */
export function Reveal({ children, className, retraso = 0, efecto = "hubly-reveal" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-visible={visible ? "true" : "false"} data-delay={retraso || undefined} className={className ? `${efecto} ${className}` : efecto}>
      {children}
    </div>
  );
}
