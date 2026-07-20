interface DustParticle {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  drift: number;
  phase: number;
  tone: number;
}

type CanvasTheme = "academia" | "scroll" | "observatory";

const canvasThemeConfig: Record<CanvasTheme, {
  primary: [number, number, number];
  secondary: [number, number, number];
  speed: number;
  density: number;
}> = {
  academia: { primary: [212, 184, 114], secondary: [232, 223, 212], speed: 1, density: 1 },
  scroll: { primary: [45, 60, 51], secondary: [166, 66, 50], speed: 0.46, density: 0.72 },
  observatory: { primary: [109, 169, 163], secondary: [207, 216, 216], speed: 0.7, density: 1.08 }
};

const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let initialized = false;

function currentCanvasTheme(): CanvasTheme {
  const value = document.documentElement.dataset.theme;
  return value === "scroll" || value === "observatory" ? value : "academia";
}

export function initMuseumCanvas() {
  if (initialized) return;

  const canvas = document.querySelector<HTMLCanvasElement>("[data-museum-canvas]");
  const context = canvas?.getContext("2d", { alpha: true });
  if (!canvas || !context) return;

  initialized = true;
  let width = 0;
  let height = 0;
  let particles: DustParticle[] = [];
  let animationFrame = 0;
  let lastTime = performance.now();

  const createParticle = (randomY = true): DustParticle => ({
    x: Math.random() * width,
    y: randomY ? Math.random() * height : height + Math.random() * 24,
    radius: 0.45 + Math.random() * 1.25,
    alpha: 0.08 + Math.random() * 0.22,
    speed: 2.5 + Math.random() * 8,
    drift: 4 + Math.random() * 12,
    phase: Math.random() * Math.PI * 2,
    tone: Math.random()
  });

  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const theme = canvasThemeConfig[currentCanvasTheme()];
    const density = (width < 760 ? 0.000055 : 0.000075) * theme.density;
    const particleCount = Math.min(width < 760 ? 34 : 72, Math.max(18, Math.round(width * height * density)));
    particles = Array.from({ length: particleCount }, () => createParticle());
  };

  const draw = (time: number) => {
    animationFrame = 0;
    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    context.clearRect(0, 0, width, height);

    const activeTheme = currentCanvasTheme();
    const theme = canvasThemeConfig[activeTheme];

    if (activeTheme === "observatory") {
      context.save();
      context.lineWidth = 0.45;
      particles.forEach((particle, index) => {
        for (let targetIndex = index + 1; targetIndex < Math.min(particles.length, index + 6); targetIndex += 1) {
          const target = particles[targetIndex];
          const distance = Math.hypot(particle.x - target.x, particle.y - target.y);
          if (distance > 118) continue;
          context.beginPath();
          context.strokeStyle = `rgba(109, 169, 163, ${(1 - distance / 118) * 0.075})`;
          context.moveTo(particle.x, particle.y);
          context.lineTo(target.x, target.y);
          context.stroke();
        }
      });
      context.restore();
    }

    particles.forEach((particle) => {
      if (!reduceMotionQuery.matches) {
        particle.y -= particle.speed * theme.speed * delta;
        particle.x += Math.sin(time * 0.00016 + particle.phase) * particle.drift * delta;
        if (particle.y < -12 || particle.x < -24 || particle.x > width + 24) {
          Object.assign(particle, createParticle(false));
        }
      }

      const shimmer = 0.72 + Math.sin(time * 0.0007 + particle.phase) * 0.28;
      const color = particle.tone > 0.82 ? theme.secondary : theme.primary;
      context.beginPath();
      context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${particle.alpha * shimmer})`;
      if (activeTheme === "scroll") {
        context.ellipse(
          particle.x,
          particle.y,
          particle.radius * 1.8,
          Math.max(0.32, particle.radius * 0.42),
          particle.phase,
          0,
          Math.PI * 2
        );
      } else {
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      }
      context.fill();
    });

    if (!document.hidden && !reduceMotionQuery.matches) {
      animationFrame = requestAnimationFrame(draw);
    }
  };

  const start = () => {
    if (animationFrame || document.hidden) return;
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(draw);
  };

  const syncPlayback = () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (reduceMotionQuery.matches) {
      draw(performance.now());
      return;
    }
    start();
  };

  resize();
  start();
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", syncPlayback);
  document.addEventListener("museum-theme-change", () => {
    resize();
    syncPlayback();
  });
  reduceMotionQuery.addEventListener("change", syncPlayback);
}
