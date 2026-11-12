import { useEffect, useRef } from "react";

interface Streak {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
}

interface Drop {
  x: number;
  y: number;
  radius: number;
  age: number;
  life: number;
  slide: number;
}

const streakCount = 90;
const dropCount = 14;
const slant = 0.18;

// Rendering only: Math.random is fine here, the simulation never sees these values.
function resetStreak(streak: Streak, width: number, height: number, anywhere: boolean) {
  streak.x = Math.random() * (width + height * slant);
  streak.y = anywhere ? Math.random() * height : -40 - Math.random() * height * 0.3;
  streak.length = 14 + Math.random() * 22;
  streak.speed = 900 + Math.random() * 700;
  streak.alpha = 0.1 + Math.random() * 0.14;
}

function resetDrop(drop: Drop, width: number, height: number, spread: boolean) {
  drop.x = Math.random() * width;
  drop.y = Math.random() * height * 0.85;
  drop.radius = 3 + Math.random() * 7;
  drop.life = 4 + Math.random() * 6;
  drop.age = spread ? Math.random() * drop.life : 0;
  drop.slide = Math.random() < 0.35 ? 6 + Math.random() * 18 : 0;
}

function dropSprite() {
  const size = 64;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const context = sprite.getContext("2d");
  if (!context) return sprite;
  const gradient = context.createRadialGradient(22, 22, 3, 32, 32, 31);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.5)");
  gradient.addColorStop(0.55, "rgba(190, 210, 230, 0.12)");
  gradient.addColorStop(1, "rgba(20, 30, 45, 0.3)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(32, 32, 31, 0, Math.PI * 2);
  context.fill();
  return sprite;
}

/** A light rain layer over the scene: faint falling streaks and a few drops on the lens. */
export function RainOverlay({
  active,
  reducedMotion,
}: {
  active: boolean;
  reducedMotion: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context || !active) return;
    const streaks: Streak[] = Array.from({ length: streakCount }, () => ({
      x: 0,
      y: 0,
      length: 0,
      speed: 0,
      alpha: 0,
    }));
    const drops: Drop[] = Array.from({ length: dropCount }, () => ({
      x: 0,
      y: 0,
      radius: 0,
      age: 0,
      life: 1,
      slide: 0,
    }));
    const sprite = dropSprite();
    let width = 0;
    let height = 0;
    const resize = () => {
      width = element.clientWidth;
      height = element.clientHeight;
      element.width = width;
      element.height = height;
      for (const streak of streaks) resetStreak(streak, width, height, true);
      for (const drop of drops) resetDrop(drop, width, height, true);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    let last = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      context.clearRect(0, 0, width, height);
      if (!reducedMotion) {
        context.lineWidth = 1;
        context.lineCap = "round";
        context.strokeStyle = "rgb(200, 220, 240)";
        for (const streak of streaks) {
          streak.y += streak.speed * delta;
          streak.x -= streak.speed * slant * delta;
          if (streak.y - streak.length > height) resetStreak(streak, width, height, false);
          context.globalAlpha = streak.alpha;
          context.beginPath();
          context.moveTo(streak.x, streak.y);
          context.lineTo(streak.x + streak.length * slant, streak.y - streak.length);
          context.stroke();
        }
      }
      for (const drop of drops) {
        if (!reducedMotion) {
          drop.age += delta;
          if (drop.age > drop.life) resetDrop(drop, width, height, false);
          drop.y += drop.slide * delta;
        }
        const fadeIn = Math.min(1, drop.age / 0.6);
        const fadeOut = Math.min(1, (drop.life - drop.age) / 1.5);
        const opacity = Math.max(0, Math.min(fadeIn, fadeOut)) * 0.75;
        context.globalAlpha = opacity;
        context.drawImage(
          sprite,
          drop.x - drop.radius,
          drop.y - drop.radius * 1.12,
          drop.radius * 2,
          drop.radius * 2.24,
        );
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active, reducedMotion]);

  return active ? (
    <div className="rain-overlay" aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  ) : null;
}
