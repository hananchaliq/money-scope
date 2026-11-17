'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Clock,
  Utensils,
  Box,
  Plus,
} from 'lucide-react';

export type NavTabId =
  | 'dashboard'
  | 'transactions'
  | 'analytics'
  | 'budgets'
  | 'nutrition'
  | 'studio3d'
  | 'reports'
  | 'settings';

interface MobileLiquidNavbarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  onQuickAdd: () => void;
}

interface PrimaryNavItem {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_MOBILE_TABS: PrimaryNavItem[] = [
  { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transaksi', icon: ArrowLeftRight },
  { id: 'analytics', label: 'Analitik', icon: Clock },
  { id: 'nutrition', label: 'Nutrisi AI', icon: Utensils },
  { id: 'studio3d', label: '3D Vault', icon: Box },
];

export function MobileLiquidNavbar({
  activeTab,
  onSelectTab,
  onQuickAdd,
}: MobileLiquidNavbarProps) {
  const pillRef = useRef<HTMLDivElement>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [dragLensIdx, setDragLensIdx] = useState<number | null>(null);
  const [dragXRatio, setDragXRatio] = useState<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  const activeIdx = PRIMARY_MOBILE_TABS.findIndex((t) => t.id === activeTab);
  const lensIndex = dragLensIdx !== null ? dragLensIdx : activeIdx >= 0 ? activeIdx : 0;

  const computeIndexFromClientX = (clientX: number) => {
    if (!pillRef.current) return lensIndex;
    const rect = pillRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = relX / rect.width;
    setDragXRatio(ratio);
    const idx = Math.min(
      PRIMARY_MOBILE_TABS.length - 1,
      Math.max(0, Math.floor(ratio * PRIMARY_MOBILE_TABS.length))
    );
    return idx;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>, idx: number) => {
    setDragLensIdx(idx);
    onSelectTab(PRIMARY_MOBILE_TABS[idx].id);
    computeIndexFromClientX(e.clientX);
    // Immediately activate liquid glass rainbow refraction on press, and sustain on hold/drag
    setIsHolding(true);
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!isHolding) return;
    const idx = computeIndexFromClientX(e.clientX);
    if (idx !== lensIndex) {
      setDragLensIdx(idx);
      onSelectTab(PRIMARY_MOBILE_TABS[idx].id);
    }
  };

  const handlePointerUpOrLeave = () => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    // Keep the liquid rainbow bloom visible briefly after release so the user sees the settling refraction
    holdTimerRef.current = window.setTimeout(() => {
      setIsHolding(false);
      setDragXRatio(null);
      setDragLensIdx(null);
    }, 650);
  };

  // Calculate left percentage for the liquid glass bubble
  const tabCount = PRIMARY_MOBILE_TABS.length;
  const targetLeftPercent =
    isHolding && dragXRatio !== null
      ? Math.max(10, Math.min(90, dragXRatio * 100))
      : ((lensIndex + 0.5) / tabCount) * 100;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden px-3 pb-3 pt-1 pointer-events-none select-none"
      aria-label="Navigasi Bawah Mobile iOS Liquid Glass"
    >
      {/* Hidden SVG Optical Refraction Filter for authentic iOS 26 Liquid Glass */}
      <svg className="sr-only" aria-hidden="true">
        <defs>
          <filter id="ios-liquid-refraction" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015 0.04"
              numOctaves="2"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="6"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div className="max-w-md mx-auto flex items-center gap-2.5 pointer-events-auto">
        {/* Main iOS 26 Liquid Glass Pill Container (matches Image 5 & Auralys) */}
        <div
          ref={pillRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrLeave}
          onPointerCancel={handlePointerUpOrLeave}
          onPointerLeave={handlePointerUpOrLeave}
          style={{ touchAction: 'none' }}
          className="relative flex-1 h-[62px] rounded-full bg-neutral-900/85 dark:bg-neutral-900/88 backdrop-blur-2xl border border-white/15 shadow-[0_14px_34px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-1px_2px_rgba(0,0,0,0.6)] flex items-center justify-between px-1.5 overflow-visible"
        >
          {/* Subtle inner glass sheen */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.09] via-transparent to-black/30"
          />

          {/* Protruding iOS Liquid Glass Lens Bubble with Prismatic Rainbow Rim */}
          <motion.div
            aria-hidden="true"
            animate={{
              left: `${targetLeftPercent}%`,
              scaleX: isHolding ? 1.12 : 1.0,
              scaleY: isHolding ? 1.15 : 1.0,
            }}
            transition={{
              type: 'spring',
              stiffness: 420,
              damping: 28,
              mass: 0.7,
            }}
            style={{
              width: isHolding ? '114px' : '74px',
              height: isHolding ? '70px' : '52px',
              x: '-50%',
            }}
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 z-20 rounded-full flex items-center justify-center transition-[width,height] duration-150"
          >
            {/* Outer Prismatic Rainbow Refraction Rim (vivid on press-and-hold like Image 5) */}
            <div
              className={`absolute inset-0 rounded-full transition-opacity duration-200 ${
                isHolding ? 'opacity-100' : 'opacity-65'
              }`}
              style={{
                padding: isHolding ? '2.5px' : '1.5px',
                background: isHolding
                  ? 'conic-gradient(from 180deg at 50% 50%, #00f2fe 0deg, #4facfe 45deg, #10b981 95deg, #facc15 145deg, #f43f5e 190deg, #a855f7 240deg, #38bdf8 300deg, #00f2fe 360deg)'
                  : 'linear-gradient(135deg, rgba(56,189,248,0.65), rgba(16,185,129,0.35), rgba(255,255,255,0.45))',
                WebkitMask:
                  'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                filter: isHolding ? 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.55))' : 'none',
              }}
            />

            {/* Secondary Chromatic Dispersion Caustics along Top & Bottom Curvature (Image 5 exact look) */}
            <AnimatePresence>
              {isHolding && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-[1px] rounded-full pointer-events-none"
                  style={{
                    boxShadow:
                      'inset 0 4px 8px -1px rgba(56, 189, 248, 0.75), inset 0 -4px 8px -1px rgba(16, 185, 129, 0.7), inset 5px 0 10px -2px rgba(99, 102, 241, 0.65), inset -5px 0 10px -2px rgba(250, 204, 21, 0.6), 0 10px 28px rgba(0, 0, 0, 0.65)',
                    background:
                      'radial-gradient(120% 95% at 50% 18%, rgba(255,255,255,0.34) 0%, rgba(56,189,248,0.14) 42%, rgba(15,23,42,0.28) 78%, rgba(16,185,129,0.24) 100%)',
                    backdropFilter: 'blur(6px) saturate(210%) contrast(115%)',
                  }}
                />
              )}
            </AnimatePresence>

            {/* Resting Liquid Glass Lens Body */}
            {!isHolding && (
              <div
                className="absolute inset-[1px] rounded-full"
                style={{
                  background:
                    'radial-gradient(100% 100% at 50% 15%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 55%, rgba(16,185,129,0.14) 100%)',
                  boxShadow:
                    'inset 0 1.5px 2px rgba(255,255,255,0.45), inset 0 -1.5px 3px rgba(56,189,248,0.35), 0 4px 14px rgba(0,0,0,0.4)',
                }}
              />
            )}

            {/* Top Specular Glass Arc Highlight (Exact iOS 26 lens reflection) */}
            <div
              className="absolute top-[3px] left-[16%] right-[16%] h-[6px] rounded-full pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 100%)',
                opacity: isHolding ? 0.95 : 0.6,
              }}
            />

            {/* Bottom Refracted Rim Arc */}
            <div
              className="absolute bottom-[3px] left-[18%] right-[18%] h-[4px] rounded-full pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, rgba(56,189,248,0.8), rgba(16,185,129,0.9), rgba(250,204,21,0.8))',
                opacity: isHolding ? 0.95 : 0.4,
                filter: 'blur(0.5px)',
              }}
            />
          </motion.div>

          {/* Tab Buttons */}
          {PRIMARY_MOBILE_TABS.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            const isUnderLens = lensIndex === idx;

            return (
              <button
                key={item.id}
                type="button"
                onPointerDown={(e) => handlePointerDown(e, idx)}
                onClick={() => onSelectTab(item.id)}
                aria-label={item.label}
                aria-current={isSelected ? 'page' : undefined}
                className="relative z-30 flex-1 min-h-[54px] flex flex-col items-center justify-center gap-0.5 rounded-full focus-visible:outline-none"
              >
                <motion.div
                  animate={{
                    scale: isUnderLens && isHolding ? 1.26 : isSelected ? 1.08 : 1.0,
                    y: isUnderLens && isHolding ? -1 : 0,
                  }}
                  transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                  className="flex flex-col items-center justify-center"
                >
                  <Icon
                    className={`w-[20px] h-[20px] transition-colors duration-150 ${
                      isUnderLens && isHolding
                        ? 'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]'
                        : isSelected
                        ? 'text-emerald-400'
                        : 'text-neutral-300'
                    }`}
                  />
                  <span
                    className={`text-[10px] font-semibold tracking-tight leading-none mt-1 whitespace-nowrap transition-colors duration-150 ${
                      isUnderLens && isHolding
                        ? 'text-sky-300 font-bold'
                        : isSelected
                        ? 'text-white'
                        : 'text-neutral-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </motion.div>
              </button>
            );
          })}
        </div>

        {/* Subtle Liquid Metaball Bridge between Main Pill and Right Circle (matches Image 5) */}
        <div
          aria-hidden="true"
          className="w-2.5 h-5 -mx-2 bg-neutral-900/90 border-y border-white/15 shrink-0 pointer-events-none"
        />

        {/* Detached Right Circular Liquid Glass Action Button (Quick Add, matching Image 5's right circle) */}
        <motion.button
          type="button"
          whileTap={{ scale: 1.16 }}
          onClick={onQuickAdd}
          aria-label="Catat Transaksi Cepat"
          className="relative w-[58px] h-[58px] shrink-0 rounded-full bg-neutral-900/90 border border-white/20 shadow-[0_12px_28px_rgba(0,0,0,0.55),inset_0_1.5px_2px_rgba(255,255,255,0.35),inset_0_-2px_6px_rgba(16,185,129,0.45)] flex items-center justify-center text-emerald-400 active:text-sky-300 transition-colors overflow-hidden"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full opacity-75"
            style={{
              background:
                'radial-gradient(circle at 50% 20%, rgba(255,255,255,0.22), transparent 60%)',
            }}
          />
          <Plus className="w-6 h-6 relative z-10 stroke-[2.5]" />
        </motion.button>
      </div>
    </nav>
  );
}
