// src/components/DesignPreview.jsx
// ─────────────────────────────────────────────────────────────
// Live product preview backed by real mockup photos.
// Design overlay is draggable / resizable / rotatable.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Print area definitions (as fractions of container size) ──
// Tune these to match the actual mockup photo framing.
// xPct / yPct = centre of the area; wPct / hPct = its dimensions.
export const PRINT_AREAS = {
  front: { xPct: 0.5, yPct: 0.38, wPct: 0.44, hPct: 0.44 },
  back:  { xPct: 0.5, yPct: 0.38, wPct: 0.44, hPct: 0.44 },
};

const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

/** Returns a default placement centred on the print area. */
export function makeDefaultPlacement(side = 'front') {
  const pa = PRINT_AREAS[side] || PRINT_AREAS.front;
  return { x: pa.xPct, y: pa.yPct, wPct: pa.wPct * 0.70, rotation: 0, flipped: false };
}

// ── DesignPreview ─────────────────────────────────────────────
/**
 * Props:
 *   mockupUrl         – URL of the product photo for current colour + side
 *   side              – 'front' | 'back'
 *   onSideChange      – (side: string) => void
 *   availableSides    – string[]
 *   localDesignUrl    – blob URL from URL.createObjectURL(file)
 *   placement         – { x, y, wPct, rotation, flipped } | null
 *   onPlacementChange – (placement) => void
 */
export default function DesignPreview({
  mockupUrl,
  side,
  onSideChange,
  availableSides = ['front'],
  localDesignUrl,
  placement,
  onPlacementChange,
}) {
  const containerRef = useRef(null);
  const placementRef = useRef(placement);
  useEffect(() => { placementRef.current = placement; }, [placement]);

  const [containerW, setContainerW] = useState(0);
  const [designAR, setDesignAR]     = useState(1);
  const [imgLoaded, setImgLoaded]   = useState(false);

  // Logo placeholder: own drag/resize/rotate state
  const logoPlacementRef = useRef(null);
  const [logoPlacement, setLogoPlacement] = useState(null);
  const updateLogo = useCallback((next) => {
    logoPlacementRef.current = next;
    setLogoPlacement({ ...next });
  }, []);

  // Reset logo placement when side changes
  useEffect(() => {
    const newPa = PRINT_AREAS[side] || PRINT_AREAS.front;
    const init = { x: newPa.xPct, y: newPa.yPct, wPct: newPa.wPct * 0.55, rotation: 0 };
    logoPlacementRef.current = init;
    setLogoPlacement(init);
  }, [side]);

  // Measure container width for % → px conversions
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Reset img-loaded state when mockup changes
  useEffect(() => { setImgLoaded(false); }, [mockupUrl]);

  // Measure design aspect ratio once loaded
  useEffect(() => {
    if (!localDesignUrl) return;
    const img = new Image();
    img.onload = () => setDesignAR(img.naturalWidth / img.naturalHeight);
    img.src = localDesignUrl;
  }, [localDesignUrl]);

  const pa = PRINT_AREAS[side] || PRINT_AREAS.front;
  const hasDesign = !!localDesignUrl && !!placement && containerW > 0;

  const overlayW = hasDesign ? placement.wPct * containerW : 0;
  const overlayH = overlayW / designAR;

  // ── Drag ────────────────────────────────────────────────────
  const startDrag = useCallback((e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const { x: px, y: py } = placementRef.current;
    function onMove(me) {
      onPlacementChange({
        ...placementRef.current,
        x: clamp(px + (me.clientX - startX) / rect.width,  0, 1),
        y: clamp(py + (me.clientY - startY) / rect.height, 0, 1),
      });
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  }, [onPlacementChange]);

  // ── Resize (distance-from-centre, rotation-agnostic) ────────
  const startResize = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.left + placementRef.current.x * rect.width;
    const cy = rect.top  + placementRef.current.y * rect.height;
    const startDist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
    const startW = placementRef.current.wPct;
    function onMove(me) {
      const d = Math.hypot(me.clientX - cx, me.clientY - cy);
      onPlacementChange({ ...placementRef.current, wPct: clamp(startW * (d / startDist), 0.05, 0.90) });
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  }, [onPlacementChange]);

  // ── Rotate ──────────────────────────────────────────────────
  const startRotate = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.left + placementRef.current.x * rect.width;
    const cy = rect.top  + placementRef.current.y * rect.height;
    function onMove(me) {
      const angle = Math.atan2(me.clientY - cy, me.clientX - cx) * (180 / Math.PI) + 90;
      onPlacementChange({ ...placementRef.current, rotation: angle });
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  }, [onPlacementChange]);

  // ── Logo placeholder drag ────────────────────────────────────
  const startLogoDrag = useCallback((e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const { x: px, y: py } = logoPlacementRef.current;
    function onMove(me) {
      updateLogo({
        ...logoPlacementRef.current,
        x: clamp(px + (me.clientX - startX) / rect.width,  0, 1),
        y: clamp(py + (me.clientY - startY) / rect.height, 0, 1),
      });
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  }, [updateLogo]);

  // ── Logo placeholder resize ──────────────────────────────────
  const startLogoResize = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.left + logoPlacementRef.current.x * rect.width;
    const cy = rect.top  + logoPlacementRef.current.y * rect.height;
    const startDist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
    const startW = logoPlacementRef.current.wPct;
    function onMove(me) {
      const d = Math.hypot(me.clientX - cx, me.clientY - cy);
      updateLogo({ ...logoPlacementRef.current, wPct: clamp(startW * (d / startDist), 0.05, 0.90) });
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  }, [updateLogo]);

  // ── Logo placeholder rotate ──────────────────────────────────
  const startLogoRotate = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.left + logoPlacementRef.current.x * rect.width;
    const cy = rect.top  + logoPlacementRef.current.y * rect.height;
    function onMove(me) {
      const angle = Math.atan2(me.clientY - cy, me.clientX - cx) * (180 / Math.PI) + 90;
      updateLogo({ ...logoPlacementRef.current, rotation: angle });
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  }, [updateLogo]);

  // ── Action buttons ───────────────────────────────────────────
  const handleCenter = useCallback(() => {
    const a = PRINT_AREAS[side] || PRINT_AREAS.front;
    onPlacementChange({ ...placementRef.current, x: a.xPct, y: a.yPct });
  }, [onPlacementChange, side]);

  const handleReset = useCallback(() => {
    onPlacementChange(makeDefaultPlacement(side));
  }, [onPlacementChange, side]);

  const handleFlip = useCallback(() => {
    onPlacementChange({ ...placementRef.current, flipped: !placementRef.current.flipped });
  }, [onPlacementChange]);

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">

      {/* Side toggle */}
      {availableSides.length > 1 && (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl self-start">
          {availableSides.map(s => (
            <button
              key={s}
              onClick={() => onSideChange(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                side === s ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Canvas ────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative aspect-[4/5] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 select-none"
      >
        {/* ── Mockup photo ── */}
        {mockupUrl ? (
          <>
            {/* Skeleton shimmer while photo loads */}
            {!imgLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-slate-200 to-slate-100" />
            )}
            <img
              key={mockupUrl}
              src={mockupUrl}
              alt="product mockup"
              onLoad={() => setImgLoaded(true)}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
              draggable={false}
            />
          </>
        ) : (
          /* No image for this colour/side */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
            <svg className="w-14 h-14 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <p className="text-xs font-medium text-center px-6">
              Mockup not available for this color.
            </p>
          </div>
        )}

        {/* ── Print area (dashed outline, no label) ── */}
        <div
          className="absolute pointer-events-none"
          style={{
            left:   `${(pa.xPct - pa.wPct / 2) * 100}%`,
            top:    `${(pa.yPct - pa.hPct / 2) * 100}%`,
            width:  `${pa.wPct * 100}%`,
            height: `${pa.hPct * 100}%`,
            border: '1.5px dashed rgba(99,102,241,0.50)',
            borderRadius: 4,
          }}
        />

        {/* ── "YOUR LOGO" placeholder ── */}
        {!hasDesign && containerW > 0 && mockupUrl && (
          <div
            className="absolute pointer-events-none"
            style={{
              left:      `${pa.xPct * 100}%`,
              top:       `${pa.yPct * 100}%`,
              width:     pa.wPct * containerW * 0.58,
              transform: 'translate(-50%, -50%)',
              display:   'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              opacity: 0.45,
            }}
          >
            <svg viewBox="0 0 80 80" style={{ width: '50%', height: 'auto' }}>
              <path d="M40 40 L40 10 A30 30 0 0 1 66 25 Z" fill="#f97316" />
              <path d="M40 40 L66 25 A30 30 0 0 1 66 55 Z" fill="#eab308" />
              <path d="M40 40 L66 55 A30 30 0 0 1 40 70 Z" fill="#22c55e" />
              <path d="M40 40 L40 70 A30 30 0 0 1 14 55 Z" fill="#3b82f6" />
              <path d="M40 40 L14 55 A30 30 0 0 1 14 25 Z" fill="#a855f7" />
              <path d="M40 40 L14 25 A30 30 0 0 1 40 10 Z" fill="#ec4899" />
              <circle cx="40" cy="40" r="13" fill="white" />
              <circle cx="40" cy="40" r="9"  fill="#e0e7ff" />
            </svg>
            <span style={{
              fontFamily:    'system-ui, sans-serif',
              fontWeight:    700,
              fontSize:      Math.max(9, pa.wPct * containerW * 0.11),
              letterSpacing: '0.12em',
              color:         '#475569',
              textTransform: 'uppercase',
              whiteSpace:    'nowrap',
            }}>
              Your Logo
            </span>
          </div>
        )}

        {/* ── Design overlay ── */}
        {hasDesign && (
          <div
            onPointerDown={startDrag}
            style={{
              position: 'absolute',
              left:     `${placement.x * 100}%`,
              top:      `${placement.y * 100}%`,
              width:    overlayW,
              height:   overlayH,
              transform: `translate(-50%,-50%) rotate(${placement.rotation}deg) scaleX(${placement.flipped ? -1 : 1})`,
              cursor: 'grab',
              touchAction: 'none',
              zIndex: 10,
            }}
          >
            {/* Design image – printed-on-fabric feel */}
            <img
              src={localDesignUrl}
              alt="your design"
              className="w-full h-full object-contain"
              draggable={false}
              style={{
                opacity: 0.92,
                filter:  'drop-shadow(0 1px 4px rgba(0,0,0,0.22))',
              }}
            />

            {/* Selection outline */}
            <div
              className="absolute inset-0 pointer-events-none rounded-sm"
              style={{ outline: '2px dashed rgba(99,102,241,0.80)', outlineOffset: 2 }}
            />

            {/* Rotate handle (top-centre) */}
            <div
              onPointerDown={startRotate}
              title="Drag to rotate"
              style={{
                position: 'absolute', top: -28, left: '50%',
                transform: 'translateX(-50%)',
                width: 22, height: 22, borderRadius: '50%',
                background: '#6366f1', border: '2.5px solid white',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                cursor: 'grab', touchAction: 'none', zIndex: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.3"/>
              </svg>
            </div>

            {/* Corner resize handles */}
            {[
              { top: -6,    left: -6,  cursor: 'nwse-resize' },
              { top: -6,    right: -6, cursor: 'nesw-resize' },
              { bottom: -6, left: -6,  cursor: 'nesw-resize' },
              { bottom: -6, right: -6, cursor: 'nwse-resize' },
            ].map((pos, i) => (
              <div
                key={i}
                onPointerDown={startResize}
                title="Drag to resize"
                style={{
                  position: 'absolute',
                  width: 12, height: 12, borderRadius: 3,
                  background: 'white', border: '2px solid #6366f1',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.20)',
                  cursor: pos.cursor, touchAction: 'none', zIndex: 20,
                  ...pos,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Action bar ──────────────────────────────────────────── */}
      {hasDesign && (
        <div className="flex gap-2">
          {[
            { label: 'Center', onClick: handleCenter },
            { label: 'Reset',  onClick: handleReset  },
            { label: '↔ Flip', onClick: handleFlip   },
          ].map(({ label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex-1 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Sliders ─────────────────────────────────────────────── */}
      {hasDesign && (
        <div className="space-y-2.5 bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-12 flex-shrink-0">Scale</span>
            <input
              type="range" min={5} max={90}
              value={Math.round(placement.wPct * 100)}
              onChange={e => onPlacementChange({ ...placement, wPct: Number(e.target.value) / 100 })}
              className="flex-1 accent-indigo-600"
            />
            <span className="text-xs text-slate-500 w-8 text-right">{Math.round(placement.wPct * 100)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-12 flex-shrink-0">Rotate</span>
            <input
              type="range" min={-180} max={180}
              value={Math.round(placement.rotation)}
              onChange={e => onPlacementChange({ ...placement, rotation: Number(e.target.value) })}
              className="flex-1 accent-indigo-600"
            />
            <span className="text-xs text-slate-500 w-8 text-right">{Math.round(placement.rotation)}°</span>
          </div>
        </div>
      )}
    </div>
  );
}
