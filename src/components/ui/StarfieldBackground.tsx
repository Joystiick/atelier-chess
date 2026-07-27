"use client";

import { useEffect, useRef } from "react";

const BASE_CELL = 10;
const RADIUS = 48;
const MAX_LIFT = 7;
/** Hard cap so browser zoom cannot explode the draw loop / canvas memory */
const MAX_CSS_W = 1600;
const MAX_CSS_H = 900;
const MAX_DOTS = 180;

export function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let mouseX = -9999;
    let mouseY = -9999;
    let targetX = -9999;
    let targetY = -9999;
    let raf = 0;
    let running = true;
    let cell = BASE_CELL;
    let interactive = true;

    const resize = () => {
      const scale = window.visualViewport?.scale ?? 1;
      // At high zoom, skip the lift effect entirely — prevents freezes/crashes
      interactive = scale <= 1.15;
      dpr = Math.min(window.devicePixelRatio || 1, interactive ? 1.5 : 1);
      width = Math.min(window.innerWidth, MAX_CSS_W);
      height = Math.min(window.innerHeight, MAX_CSS_H);
      cell = scale > 1.05 ? Math.ceil(BASE_CELL * scale) : BASE_CELL;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
    };

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const onLeave = () => {
      targetX = -9999;
      targetY = -9999;
    };

    const draw = () => {
      if (!running) return;

      mouseX = targetX;
      mouseY = targetY;

      ctx.clearRect(0, 0, width, height);

      if (interactive && mouseX > -500 && mouseY > -500) {
        const colMin = Math.max(0, Math.floor((mouseX - RADIUS) / cell));
        const colMax = Math.min(
          Math.ceil(width / cell),
          Math.ceil((mouseX + RADIUS) / cell),
        );
        const rowMin = Math.max(0, Math.floor((mouseY - RADIUS) / cell));
        const rowMax = Math.min(
          Math.ceil(height / cell),
          Math.ceil((mouseY + RADIUS) / cell),
        );

        let drawn = 0;
        for (let col = colMin; col < colMax && drawn < MAX_DOTS; col++) {
          for (let row = rowMin; row < rowMax && drawn < MAX_DOTS; row++) {
            const cx = col * cell + cell / 2;
            const cy = row * cell + cell / 2;
            const dx = cx - mouseX;
            const dy = cy - mouseY;
            const dist = Math.hypot(dx, dy);
            if (dist > RADIUS) continue;

            const t = 1 - dist / RADIUS;
            const ease = t * t * (3 - 2 * t);
            const lift = ease * MAX_LIFT;
            const size = 1.1 + ease * 1.6;
            const alpha = 0.12 + ease * 0.5;

            ctx.beginPath();
            ctx.fillStyle = `rgba(0, 0, 0, ${0.18 * ease})`;
            ctx.arc(cx + 0.6, cy + 1.2, size * 0.9, 0, Math.PI * 2);
            ctx.fill();

            const g = 90 + Math.floor(ease * 90);
            const r = 20 + Math.floor(ease * 40);
            const b = 40 + Math.floor(ease * 30);
            ctx.beginPath();
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.arc(cx, cy - lift, size, 0, Math.PI * 2);
            ctx.fill();

            drawn += 1;
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div className="starfield" aria-hidden>
      <div className="starfield-layer" />
      <canvas ref={canvasRef} className="starfield-interactive" />
    </div>
  );
}
