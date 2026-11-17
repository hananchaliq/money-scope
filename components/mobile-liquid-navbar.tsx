'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Clock,
  Utensils,
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
  { id: 'nutrition', label: 'Nutrisi', icon: Utensils },
];

const LENS_WIDTH = 122;
const LENS_HEIGHT = 76;

export function MobileLiquidNavbar({
  activeTab,
  onSelectTab,
  onQuickAdd,
}: MobileLiquidNavbarProps) {
  const pillRef = useRef<HTMLDivElement>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [dragLensIdx, setDragLensIdx] = useState<number | null>(null);
  const [pillWidth, setPillWidth] = useState<number>(300);
  const [lensCenterX, setLensCenterX] = useState<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  const activeIdx = PRIMARY_MOBILE_TABS.findIndex((t) => t.id === activeTab);
  const resolvedIdx = dragLensIdx !== null ? dragLensIdx : activeIdx >= 0 ? activeIdx : 0;

  const updateFromClientX = (clientX: number) => {
    if (!pillRef.current) return resolvedIdx;
    const rect = pillRef.current.getBoundingClientRect();
    const width = Math.max(220, rect.width);
    setPillWidth(width);

    const relX = Math.max(0, Math.min(width, clientX - rect.left));
    // Clamp lens center so the droplet stays gracefully on the pill track
    const clampedCenter = Math.max(LENS_WIDTH * 0.42, Math.min(width - LENS_WIDTH * 0.42, relX));
    setLensCenterX(clampedCenter);

    const ratio = relX / width;
    const idx = Math.min(
      PRIMARY_MOBILE_TABS.length - 1,
      Math.max(0, Math.floor(ratio * PRIMARY_MOBILE_TABS.length))
    );
    return idx;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>, idx: number) => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    if (pillRef.current) {
      const rect = pillRef.current.getBoundingClientRect();
      const width = Math.max(220, rect.width);
      setPillWidth(width);
      const tabCenter = ((idx + 0.5) / PRIMARY_MOBILE_TABS.length) * width;
      const relX = e.clientX ? e.clientX - rect.left : tabCenter;
      const clampedCenter = Math.max(
        LENS_WIDTH * 0.42,
        Math.min(width - LENS_WIDTH * 0.42, relX)
      );
      setLensCenterX(clampedCenter);
    }
    setDragLensIdx(idx);
    onSelectTab(PRIMARY_MOBILE_TABS[idx].id);
    setIsHolding(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!isHolding) return;
    const idx = updateFromClientX(e.clientX);
    if (idx !== resolvedIdx) {
      setDragLensIdx(idx);
      onSelectTab(PRIMARY_MOBILE_TABS[idx].id);
    }
  };

  const handlePointerUpOrLeave = () => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    // Keep the iOS 26.1 Liquid Glass droplet visible briefly on release so user sees the smooth optical settle
    holdTimerRef.current = window.setTimeout(() => {
      setIsHolding(false);
      setLensCenterX(null);
      setDragLensIdx(null);
    }, 600);
  };

  const tabCount = PRIMARY_MOBILE_TABS.length;
  const defaultCenterPx = ((resolvedIdx + 0.5) / tabCount) * pillWidth;
  const activeLensCenterPx =
    isHolding && lensCenterX !== null ? lensCenterX : defaultCenterPx;
  const lensLeftPx = activeLensCenterPx - LENS_WIDTH / 2;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden px-3.5 pb-4 pt-6 pointer-events-none select-none bg-gradient-to-t from-black/90 via-black/55 to-transparent"
      aria-label="Navigasi Bawah Mobile iOS Liquid Glass"
    >
      <div className="max-w-[400px] mx-auto flex items-center pointer-events-auto">
        {/* Main iOS 26.1 Matte Dark Pill Track */}
        <div
          ref={pillRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrLeave}
          onPointerCancel={handlePointerUpOrLeave}
          onPointerLeave={handlePointerUpOrLeave}
          style={{ touchAction: 'none' }}
          className="relative flex-1 h-[64px] rounded-full bg-[#1b1c20]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_16px_36px_rgba(0,0,0,0.75),inset_0_1px_0.5px_rgba(255,255,255,0.18)] flex items-center justify-between px-1 overflow-visible"
        >
          {/* Subtle Resting Active Pill Indicator (only shown when NOT holding the magnifying droplet) */}
          {!isHolding && (
            <motion.div
              layoutId="mobile-resting-pill"
              aria-hidden="true"
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              style={{
                width: `${100 / tabCount}%`,
                left: `${(resolvedIdx / tabCount) * 100}%`,
              }}
              className="pointer-events-none absolute top-1.5 bottom-1.5 z-10 px-1"
            >
              <div className="w-full h-full rounded-full bg-white/[0.09] border border-white/[0.12] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]" />
            </motion.div>
          )}

          {/* Base Layer: 4 Crisp White Tab Buttons */}
          {PRIMARY_MOBILE_TABS.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = resolvedIdx === idx;

            return (
              <button
                key={item.id}
                type="button"
                onPointerDown={(e) => handlePointerDown(e, idx)}
                onClick={() => onSelectTab(item.id)}
                aria-label={item.label}
                aria-current={isSelected ? 'page' : undefined}
                className="relative z-20 flex-1 h-full flex flex-col items-center justify-center gap-1 rounded-full focus-visible:outline-none"
              >
                <Icon
                  className={`w-[22px] h-[22px] transition-colors duration-150 ${
                    !isHolding && isSelected
                      ? 'text-[#38bdf8]'
                      : 'text-white/95'
                  }`}
                />
                <span
                  className={`text-[11px] font-medium tracking-tight leading-none whitespace-nowrap transition-colors duration-150 ${
                    !isHolding && isSelected
                      ? 'text-[#38bdf8] font-semibold'
                      : 'text-white/90'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* iOS 26.1 Beta 4 Liquid Glass Magnifying Lens Droplet (True Clipped Optical Zoom Layer) */}
          <AnimatePresence>
            {isHolding && (
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  left: `${lensLeftPx}px`,
                }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{
                  type: 'spring',
                  stiffness: 460,
                  damping: 30,
                  mass: 0.65,
                }}
                style={{
                  width: `${LENS_WIDTH}px`,
                  height: `${LENS_HEIGHT}px`,
                }}
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 z-40 rounded-full"
              >
                {/* 1. Clipped Optical Magnifier Viewport (renders 1.3x zoomed Sky-Blue #38bdf8 tabs inside the droplet, matching Image 5!) */}
                <div
                  className="relative w-full h-full rounded-full overflow-hidden"
                  style={{
                    background:
                      'radial-gradient(110% 100% at 50% 50%, #2a2c32 0%, #202227 68%, #16181d 100%)',
                    boxShadow:
                      '0 0 0 1.5px rgba(0,0,0,0.88), 0 14px 30px rgba(0,0,0,0.75)',
                  }}
                >
                  {/* Synchronized Inner Track of 4 Tabs Scaled 1.32x in iOS Cyan-Blue (#38bdf8) */}
                  <div
                    style={{
                      width: `${pillWidth}px`,
                      height: '64px',
                      transform: `translate3d(${-lensLeftPx}px, ${(LENS_HEIGHT - 64) / 2}px, 0)`,
                    }}
                    className="absolute top-0 left-0 flex items-center justify-between px-1"
                  >
                    {PRIMARY_MOBILE_TABS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={`zoom-${item.id}`}
                          className="flex-1 h-full flex flex-col items-center justify-center gap-1"
                          style={{
                            transform: 'scale(1.32)',
                            transformOrigin: 'center center',
                          }}
                        >
                          <Icon className="w-[22px] h-[22px] text-[#38bdf8] drop-shadow-[0_0_6px_rgba(56,189,248,0.45)]" />
                          <span className="text-[11px] font-bold tracking-tight leading-none text-[#38bdf8] whitespace-nowrap">
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 2. Left & Right Curved Glass Caustics (Cyan & Emerald Internal Refraction like Image 5) */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      boxShadow:
                        'inset 7px 0 10px -3px rgba(56, 189, 248, 0.72), inset -7px 0 10px -3px rgba(34, 197, 94, 0.68), inset 0 3px 6px rgba(255, 255, 255, 0.35), inset 0 -3px 6px rgba(56, 189, 248, 0.45)',
                    }}
                  />

                  {/* 3. Top Dark-Mirror Specular Band + Chromatic Fringe (Exact Image 5 Top Edge) */}
                  <div
                    className="absolute top-[2px] left-[16%] right-[16%] h-[6px] rounded-full pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(56,189,248,0.85) 0%, rgba(16,185,129,0.9) 18%, rgba(10,12,16,0.92) 38%, rgba(10,12,16,0.92) 62%, rgba(250,204,21,0.9) 82%, rgba(244,63,94,0.85) 100%)',
                      boxShadow: '0 1px 2px rgba(255,255,255,0.45)',
                    }}
                  />

                  {/* 4. Bottom Dark-Mirror Specular Band + Chromatic Fringe (Exact Image 5 Bottom Edge) */}
                  <div
                    className="absolute bottom-[2px] left-[16%] right-[16%] h-[6px] rounded-full pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(56,189,248,0.85) 0%, rgba(34,197,94,0.9) 20%, rgba(10,12,16,0.94) 40%, rgba(10,12,16,0.94) 60%, rgba(250,204,21,0.9) 80%, rgba(244,63,94,0.85) 100%)',
                      boxShadow: '0 -1px 2px rgba(56,189,248,0.4)',
                    }}
                  />
                </div>

                {/* 5. Razor-Sharp 2px Prismatic Glass Bezel Ring (Toned-Down iOS 26.1 Beta 4 Rim) */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    padding: '2px',
                    background:
                      'conic-gradient(from 180deg at 50% 50%, #38bdf8 0deg, #22c55e 55deg, #fde047 115deg, #f43f5e 170deg, #38bdf8 235deg, #10b981 300deg, #38bdf8 360deg)',
                    WebkitMask:
                      'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    opacity: 0.92,
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Authentic Dark Metaball Connector Neck (matches Image 5 pinch between pill and circle) */}
        <div
          aria-hidden="true"
          className="w-2.5 h-4 -mx-1 bg-[#1b1c20]/95 border-y border-white/[0.12] shrink-0 pointer-events-none"
        />

        {/* Detached Right Circular Action Button (matches Image 5 right circle) */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.93 }}
          whileHover={{ scale: 1.04 }}
          onClick={onQuickAdd}
          aria-label="Catat Transaksi Cepat"
          className="relative w-[62px] h-[62px] shrink-0 rounded-full bg-[#1b1c20]/95 border border-white/[0.14] shadow-[0_14px_32px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.22)] flex items-center justify-center text-white active:text-[#38bdf8] transition-colors overflow-hidden"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 50% 18%, rgba(255,255,255,0.16), transparent 62%)',
            }}
          />
          <Plus className="w-6 h-6 relative z-10 stroke-[2.4]" />
        </motion.button>
      </div>
    </nav>
  );
}
