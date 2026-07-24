"use client";

import { useEffect, useRef } from "react";

const CELL = 8;
const RADIUS = 140;
const MAX_LIFT = 10;

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

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

      // Smooth follow — feels like the field is reacting, not snapping
      mouseX += (targetX - mouseX) * 0.18;
      mouseY += (targetY - mouseY) * 0.18;

      ctx.clearRect(0, 0, width, height);

      if (mouseX > -500 && mouseY > -500) {
        const colMin = Math.max(0, Math.floor((mouseX - RADIUS) / CELL));
        const colMax = Math.min(
          Math.ceil(width / CELL),
          Math.ceil((mouseX + RADIUS) / CELL),
        );
        const rowMin = Math.max(0, Math.floor((mouseY - RADIUS) / CELL));
        const rowMax = Math.min(
          Math.ceil(height / CELL),
          Math.ceil((mouseY + RADIUS) / CELL),
        );

        for (let col = colMin; col < colMax; col++) {
          for (let row = rowMin; row < rowMax; row++) {
            const cx = col * CELL + CELL / 2;
            const cy = row * CELL + CELL / 2;
            const dx = cx - mouseX;
            const dy = cy - mouseY;
            const dist = Math.hypot(dx, dy);
            if (dist > RADIUS) continue;

            // Smooth falloff (smoothstep-ish)
            const t = 1 - dist / RADIUS;
            const ease = t * t * (3 - 2 * t);
            const lift = ease * MAX_LIFT;
            const size = 1.15 + ease * 1.85;
            const alpha = 0.12 + ease * 0.55;

            // Soft shadow under the lifted cell
            ctx.beginPath();
            ctx.fillStyle = `rgba(0, 0, 0, ${0.18 * ease})`;
            ctx.arc(cx + 0.6, cy + 1.2, size * 0.9, 0, Math.PI * 2);
            ctx.fill();

            // Lifted cell — emerald/brass tint matching Atelier
            const g = 90 + Math.floor(ease * 90);
            const r = 20 + Math.floor(ease * 40);
            const b = 40 + Math.floor(ease * 30);
            ctx.beginPath();
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.arc(cx, cy - lift, size, 0, Math.PI * 2);
            ctx.fill();

            // Specular tip when very close
            if (ease > 0.55) {
              ctx.beginPath();
              ctx.fillStyle = `rgba(232, 239, 230, ${0.25 * (ease - 0.55) * 2})`;
              ctx.arc(cx - size * 0.25, cy - lift - size * 0.25, size * 0.35, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
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
