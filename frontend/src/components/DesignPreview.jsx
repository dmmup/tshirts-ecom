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
  selectedColorHex,   // when set, tints the base mockup; null/undefined = no tint
  side,
  onSideChange,
  availableSides = ['front'],
  localDesignUrl,
  placement,
  onPlacementChange,
  onUploadClick,      // () => void — called when placeholder is tapped (no drag)
}) {
  const containerRef = useRef(null);
  const placementRef = useRef(placement);
  useEffect(() => { placementRef.current = placement; }, [placement]);

  const [containerW, setContainerW] = useState(0);
  const [designAR, setDesignAR]     = useState(1);
  const [loadedUrl, setLoadedUrl]   = useState(null);
  const imgLoaded = loadedUrl === mockupUrl;

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

  // (loadedUrl tracks which URL has loaded — no separate reset needed)

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
    let moved = false;
    function onMove(me) {
      if (!moved && Math.hypot(me.clientX - startX, me.clientY - startY) > 4) moved = true;
      if (moved) {
        updateLogo({
          ...logoPlacementRef.current,
          x: clamp(px + (me.clientX - startX) / rect.width,  0, 1),
          y: clamp(py + (me.clientY - startY) / rect.height, 0, 1),
        });
      }
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
      if (!moved && onUploadClick) onUploadClick();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  }, [updateLogo, onUploadClick]);

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
        className="relative h-[520px] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 select-none"
      >
        {/* ── Mockup photo + colour tint ──────────────────────────
             The image and tint share an isolated stacking context
             so multiply only blends against the image pixels —
             the canvas bg-slate-100 is never affected.             */}
        {mockupUrl ? (
          <div
            className="absolute inset-0"
            style={{ isolation: 'isolate' }}
          >
            {/* Skeleton shimmer while photo loads */}
            {!imgLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-slate-200 to-slate-100" />
            )}
            <img
              key={mockupUrl}
              src={mockupUrl}
              alt="product mockup"
              onLoad={() => setLoadedUrl(mockupUrl)}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
              draggable={false}
            />
            {/* Colour tint — multiply blends with image only (isolated) */}
            {selectedColorHex && imgLoaded && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundColor: selectedColorHex,
                  mixBlendMode:    'multiply',
                  opacity:         0.55,
                }}
              />
            )}
          </div>
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

        {/* ── Design placeholder – single clean box, draggable/resizable/rotatable ── */}
        {!hasDesign && containerW > 0 && mockupUrl && logoPlacement && (() => {
          const logoW = logoPlacement.wPct * containerW;
          const logoH = logoW; // square
          const iconSize = Math.max(18, logoW * 0.22);
          return (
            <div
              onPointerDown={startLogoDrag}
              style={{
                position:    'absolute',
                left:        `${logoPlacement.x * 100}%`,
                top:         `${logoPlacement.y * 100}%`,
                width:       logoW,
                height:      logoH,
                transform:   `translate(-50%, -50%) rotate(${logoPlacement.rotation}deg)`,
                cursor:      onUploadClick ? 'pointer' : 'grab',
                touchAction: 'none',
                zIndex:      10,
                userSelect:  'none',
                display:     'flex',
                flexDirection: 'column',
                alignItems:  'center',
                justifyContent: 'center',
                gap:         6,
                background:  'rgba(99,102,241,0.07)',
                border:      '1.5px dashed rgba(99,102,241,0.45)',
                borderRadius: 8,
              }}
            >
              {/* Image icon */}
              <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none"
                stroke="rgba(99,102,241,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>

              {/* Label – only when wide enough */}
              {logoW > 80 && (
                <span style={{
                  fontFamily:  'system-ui, sans-serif',
                  fontWeight:  600,
                  fontSize:    Math.max(9, logoW * 0.09),
                  color:       'rgba(99,102,241,0.65)',
                  textAlign:   'center',
                  letterSpacing: '0.02em',
                  lineHeight:  1.3,
                  userSelect:  'none',
                }}>
                  Your design
                </span>
              )}

              {/* Rotate handle */}
              <div
                onPointerDown={startLogoRotate}
                title="Drag to rotate"
                style={{
                  position: 'absolute', top: -26, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#6366f1', border: '2px solid white',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                  cursor: 'grab', touchAction: 'none', zIndex: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.3"/>
                </svg>
              </div>

              {/* Corner resize handles */}
              {[
                { top: -5,    left: -5,  cursor: 'nwse-resize' },
                { top: -5,    right: -5, cursor: 'nesw-resize' },
                { bottom: -5, left: -5,  cursor: 'nesw-resize' },
                { bottom: -5, right: -5, cursor: 'nwse-resize' },
              ].map((pos, i) => (
                <div
                  key={i}
                  onPointerDown={startLogoResize}
                  title="Drag to resize"
                  style={{
                    position: 'absolute',
                    width: 10, height: 10, borderRadius: 2,
                    background: 'white', border: '2px solid #6366f1',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    cursor: pos.cursor, touchAction: 'none', zIndex: 20,
                    ...pos,
                  }}
                />
              ))}
            </div>
          );
        })()}

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
