"use client";

import { useEffect, useRef, useState, type ElementType } from "react";

export interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: ElementType;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
  onItemSelect?: (item: TimelineItem) => void;
}

export default function RadialOrbitalTimeline({ timelineData, onItemSelect }: RadialOrbitalTimelineProps) {
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [orbitRadius, setOrbitRadius] = useState(200);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);

  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === containerRef.current || event.target === orbitRef.current) {
      setAutoRotate(true);
    }
  };

  useEffect(() => {
    const updateRadius = () => {
      const width = window.innerWidth;
      setOrbitRadius(Math.min(250, Math.max(118, width * 0.26)));
    };

    updateRadius();
    window.addEventListener("resize", updateRadius);
    return () => window.removeEventListener("resize", updateRadius);
  }, []);

  useEffect(() => {
    if (!autoRotate) return;

    const rotationTimer = window.setInterval(() => {
      setRotationAngle((previous) => Number(((previous + 0.24) % 360).toFixed(3)));
    }, 50);

    return () => window.clearInterval(rotationTimer);
  }, [autoRotate]);

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radian = (angle * Math.PI) / 180;
    const x = orbitRadius * Math.cos(radian);
    const y = orbitRadius * 0.58 * Math.sin(radian);
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(0.46, Math.min(1, 0.46 + 0.54 * ((1 + Math.sin(radian)) / 2)));

    return { x, y, zIndex, opacity };
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="radial-orbital-timeline relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-black px-4 text-white"
    >
      <div className="pointer-events-none absolute left-0 top-0 h-7 w-full bg-white" />

      <div className="relative z-10 flex h-[min(72vh,620px)] min-h-[430px] w-full max-w-5xl items-center justify-center">
        <div
          ref={orbitRef}
          className="absolute flex h-full w-full items-center justify-center"
          style={{ perspective: "1000px" }}
        >
          <button
            type="button"
            className="absolute z-10 flex h-24 w-28 items-center justify-center overflow-hidden rounded-[4px] border border-neutral-500/70 bg-neutral-900 shadow-[0_24px_70px_rgba(255,255,255,0.08)] transition hover:scale-105 hover:bg-neutral-800"
            onClick={(event) => {
              event.stopPropagation();
              onItemSelect?.(timelineData[0]);
            }}
            aria-label="Enter Trading Floor home"
          >
            <span className="absolute h-32 w-32 rounded-[999px] border border-white/10 animate-ping" />
            <span className="text-4xl font-black tracking-[-0.18em] text-neutral-500">RC</span>
          </button>

          {timelineData.map((item, index) => {
            const position = calculateNodePosition(index, timelineData.length);
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                className="absolute cursor-pointer transition-all duration-700 hover:!opacity-100"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  zIndex: position.zIndex,
                  opacity: position.opacity
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onItemSelect?.(item);
                }}
                onMouseEnter={() => setAutoRotate(false)}
                onMouseLeave={() => setAutoRotate(true)}
              >
                <div
                  className="absolute -inset-1 rounded-[999px] opacity-0 transition duration-300 hover:opacity-100"
                  style={{
                    background: "radial-gradient(circle, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0) 70%)",
                    width: `${item.energy * 0.5 + 42}px`,
                    height: `${item.energy * 0.5 + 42}px`,
                    left: `-${(item.energy * 0.5 + 2) / 2}px`,
                    top: `-${(item.energy * 0.5 + 2) / 2}px`
                  }}
                />

                <div className="flex h-12 w-12 items-center justify-center rounded-[999px] border-2 border-white bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.24)] transition-all duration-300 hover:scale-125 hover:bg-neutral-100 hover:shadow-[0_0_34px_rgba(255,255,255,0.42)]">
                  <Icon size={17} />
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
