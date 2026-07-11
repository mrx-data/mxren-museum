interface DustParticle {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  drift: number;
  phase: number;
}

const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let initialized = false;

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
    phase: Math.random() * Math.PI * 2
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

    const density = width < 760 ? 0.000055 : 0.000075;
    const particleCount = Math.min(width < 760 ? 34 : 72, Math.max(18, Math.round(width * height * density)));
    particles = Array.from({ length: particleCount }, () => createParticle());
  };

  const draw = (time: number) => {
    animationFrame = 0;
    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    context.clearRect(0, 0, width, height);

    particles.forEach((particle) => {
      if (!reduceMotionQuery.matches) {
        particle.y -= particle.speed * delta;
        particle.x += Math.sin(time * 0.00016 + particle.phase) * particle.drift * delta;
        if (particle.y < -12 || particle.x < -24 || particle.x > width + 24) {
          Object.assign(particle, createParticle(false));
        }
      }

      const shimmer = 0.72 + Math.sin(time * 0.0007 + particle.phase) * 0.28;
      context.beginPath();
      context.fillStyle = `rgba(212, 184, 114, ${particle.alpha * shimmer})`;
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
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
  reduceMotionQuery.addEventListener("change", syncPlayback);
}
