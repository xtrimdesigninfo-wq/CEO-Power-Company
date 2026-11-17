import React, { useEffect, useRef, useCallback } from 'react';

// --- Types ---

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  angle: number;
}

interface BackgroundParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
}

interface MouseState {
  x: number;
  y: number;
  isActive: boolean;
}

export interface AntiGravityCanvasProps {
  className?: string;
  accentColor?: string;
  glowRgb?: string;
  backgroundColor?: string;
}

// --- Configuration Constants ---

const PARTICLE_DENSITY = 0.00011;
const BG_PARTICLE_DENSITY = 0.00004;
const MAX_INTERACTIVE_PARTICLES = 120;
const MOUSE_RADIUS = 180;
const RETURN_SPEED = 0.08;
const DAMPING = 0.9;
const REPULSION_STRENGTH = 1.2;

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const AntiGravityCanvas: React.FC<AntiGravityCanvasProps> = ({
  className = '',
  accentColor = '#22c55e',
  glowRgb = '24, 112, 4',
  backgroundColor = '#071d02',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const particlesRef = useRef<Particle[]>([]);
  const backgroundParticlesRef = useRef<BackgroundParticle[]>([]);
  const mouseRef = useRef<MouseState>({ x: -1000, y: -1000, isActive: false });
  const frameIdRef = useRef<number>(0);
  const dimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  const initParticles = useCallback(
    (width: number, height: number) => {
      dimensionsRef.current = { width, height };

      const rawCount = Math.floor(width * height * PARTICLE_DENSITY);
      const particleCount = Math.min(rawCount, MAX_INTERACTIVE_PARTICLES);
      const newParticles: Particle[] = [];

      for (let i = 0; i < particleCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;

        newParticles.push({
          x,
          y,
          originX: x,
          originY: y,
          vx: 0,
          vy: 0,
          size: randomRange(1.2, 2.8),
          color: Math.random() > 0.72 ? accentColor : '#ffffff',
          angle: Math.random() * Math.PI * 2,
        });
      }
      particlesRef.current = newParticles;

      const bgCount = Math.min(Math.floor(width * height * BG_PARTICLE_DENSITY), 120);
      const newBgParticles: BackgroundParticle[] = [];

      for (let i = 0; i < bgCount; i++) {
        newBgParticles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          size: randomRange(0.6, 1.6),
          alpha: randomRange(0.12, 0.42),
          phase: Math.random() * Math.PI * 2,
        });
      }
      backgroundParticlesRef.current = newBgParticles;
    },
    [accentColor]
  );

  const drawFrame = useCallback(
    (time: number, animatePhysics: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = dimensionsRef.current;
      if (width === 0 || height === 0) return;

      ctx.clearRect(0, 0, width, height);

      // Pulsating radial glow centered in hero
      const centerX = width / 2;
      const centerY = height / 2;
      const pulseSpeed = 0.0008;
      const pulseOpacity = animatePhysics
        ? Math.sin(time * pulseSpeed) * 0.08 + 0.24
        : 0.24;

      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        Math.max(width, height) * 0.7
      );
      gradient.addColorStop(0, `rgba(${glowRgb}, ${pulseOpacity})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Ambient drifting background particles
      const bgParticles = backgroundParticlesRef.current;
      ctx.fillStyle = '#ffffff';

      for (let i = 0; i < bgParticles.length; i++) {
        const p = bgParticles[i];
        if (animatePhysics) {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        }

        const twinkle = animatePhysics
          ? Math.sin(time * 0.002 + p.phase) * 0.5 + 0.5
          : 0.7;
        const currentAlpha = p.alpha * (0.3 + 0.7 * twinkle);

        ctx.globalAlpha = currentAlpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Foreground interactive particles
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      if (animatePhysics) {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (mouse.isActive && distance < MOUSE_RADIUS && distance > 0.001) {
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS;
            const repulsion = force * REPULSION_STRENGTH;
            p.vx -= forceDirectionX * repulsion * 5;
            p.vy -= forceDirectionY * repulsion * 5;
          }

          const springDx = p.originX - p.x;
          const springDy = p.originY - p.y;

          p.vx += springDx * RETURN_SPEED;
          p.vy += springDy * RETURN_SPEED;
        }

        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const p1 = particles[i];
            const p2 = particles[j];

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distSq = dx * dx + dy * dy;
            const minDist = p1.size + p2.size;

            if (distSq < minDist * minDist) {
              const dist = Math.sqrt(distSq);

              if (dist > 0.01) {
                const nx = dx / dist;
                const ny = dy / dist;

                const overlap = minDist - dist;
                const pushX = nx * overlap * 0.5;
                const pushY = ny * overlap * 0.5;

                p1.x -= pushX;
                p1.y -= pushY;
                p2.x += pushX;
                p2.y += pushY;

                const dvx = p1.vx - p2.vx;
                const dvy = p1.vy - p2.vy;
                const velocityAlongNormal = dvx * nx + dvy * ny;

                if (velocityAlongNormal > 0) {
                  const m1 = p1.size;
                  const m2 = p2.size;
                  const restitution = 0.85;
                  const impulseMagnitude =
                    (-(1 + restitution) * velocityAlongNormal) / (1 / m1 + 1 / m2);

                  const impulseX = impulseMagnitude * nx;
                  const impulseY = impulseMagnitude * ny;

                  p1.vx += impulseX / m1;
                  p1.vy += impulseY / m1;
                  p2.vx -= impulseX / m2;
                  p2.vy -= impulseY / m2;
                }
              }
            }
          }
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (animatePhysics) {
          p.vx *= DAMPING;
          p.vy *= DAMPING;
          p.x += p.vx;
          p.y += p.vy;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        const velocity = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const opacity = Math.min(0.35 + velocity * 0.1, 1);

        if (p.color === '#ffffff') {
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        } else {
          ctx.globalAlpha = Math.min(0.65 + velocity * 0.1, 1);
          ctx.fillStyle = p.color;
        }

        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    },
    [glowRgb]
  );

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvasRef.current.width = width * dpr;
        canvasRef.current.height = height * dpr;
        canvasRef.current.style.width = `${width}px`;
        canvasRef.current.style.height = `${height}px`;

        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        initParticles(width, height);
        if (prefersReducedMotion) {
          drawFrame(0, false);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    let isInViewport = true;
    const stopLoop = () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = 0;
      }
    };

    const startLoop = () => {
      if (prefersReducedMotion || frameIdRef.current || document.hidden || !isInViewport) return;
      const loop = (time: number) => {
        if (document.hidden || !isInViewport) {
          frameIdRef.current = 0;
          return;
        }
        drawFrame(time, true);
        frameIdRef.current = requestAnimationFrame(loop);
      };
      frameIdRef.current = requestAnimationFrame(loop);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    };

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      observer = new IntersectionObserver(
        entries => {
          isInViewport = entries.some(e => e.isIntersecting);
          if (isInViewport) {
            startLoop();
          } else {
            stopLoop();
          }
        },
        { threshold: 0.01 }
      );
      observer.observe(containerRef.current);
    }

    document.addEventListener('visibilitychange', handleVisibility);
    startLoop();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      observer?.disconnect();
      stopLoop();
    };
  }, [initParticles, drawFrame]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      isActive: true,
    };
  };

  const handleMouseLeave = () => {
    mouseRef.current.isActive = false;
  };

  return (
    <div
      ref={containerRef}
      style={{ backgroundColor }}
      className={`absolute inset-0 z-0 overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />
    </div>
  );
};

export default AntiGravityCanvas;
