import { useCallback, useEffect, useRef, useState } from 'react';

const DAMAGE_COLORS = {
  scratch: { fill: 'rgba(245, 158, 11, 0.42)', stroke: '#f59e0b' },
  dent: { fill: 'rgba(239, 68, 68, 0.42)', stroke: '#ef4444' },
  crack: { fill: 'rgba(139, 92, 246, 0.42)', stroke: '#8b5cf6' },
  'glass shatter': { fill: 'rgba(59, 130, 246, 0.42)', stroke: '#3b82f6' },
  shatter: { fill: 'rgba(59, 130, 246, 0.42)', stroke: '#3b82f6' },
  broken: { fill: 'rgba(236, 72, 153, 0.42)', stroke: '#ec4899' },
  'lamp broken': { fill: 'rgba(236, 72, 153, 0.42)', stroke: '#ec4899' },
  flat: { fill: 'rgba(100, 116, 139, 0.42)', stroke: '#64748b' },
  'tire flat': { fill: 'rgba(100, 116, 139, 0.42)', stroke: '#64748b' },
  default: { fill: 'rgba(239, 68, 68, 0.4)', stroke: '#ef4444' },
};

const PANEL_STROKE = '#002147';

function colorForDamage(name) {
  const key = (name || '').toLowerCase();
  return DAMAGE_COLORS[key] || DAMAGE_COLORS.default;
}

export default function DamageImagePreview({ imageUrl, raw, onCanvasReady }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [lightbox, setLightbox] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const damages = raw?.damage_detection || [];
  const panels = raw?.panel_detection || [];

  useEffect(() => {
    setLoaded(false);
    setLoadError(false);
  }, [imageUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.naturalWidth) return;

    const ctx = canvas.getContext('2d');
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    panels.forEach((panel, idx) => {
      const bbox = panel.bbox;
      if (!bbox || bbox.length < 4) return;
      const [x1, y1, x2, y2] = bbox;
      ctx.strokeStyle = PANEL_STROKE;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);

      const label = `${panel.panel} (${Math.round((panel.confidence || 0) * 100)}%)`;
      const ly = Math.max(18, y1 - 8 - (idx % 3) * 14);
      ctx.font = 'bold 14px Inter, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0, 33, 71, 0.88)';
      ctx.fillRect(x1, ly - 16, tw + 12, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x1 + 6, ly);
    });

    damages.forEach((dmg) => {
      const bbox = dmg.bbox;
      if (!bbox || bbox.length < 4) return;
      const [x1, y1, x2, y2] = bbox;
      const colors = colorForDamage(dmg.damage);
      ctx.fillStyle = colors.fill;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 2;
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      const conf = `${dmg.damage} ${Math.round((dmg.confidence || 0) * 100)}%`;
      ctx.font = '12px Inter, sans-serif';
      const tw = ctx.measureText(conf).width;
      ctx.fillStyle = colors.stroke;
      ctx.fillRect(x1, y2 + 4, tw + 8, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(conf, x1 + 4, y2 + 16);
    });

    onCanvasReady?.(canvas);
  }, [damages, panels, onCanvasReady]);

  useEffect(() => {
    if (loaded) draw();
  }, [loaded, draw, imageUrl]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setLightbox(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const PreviewBody = ({ expanded }) => (
    <div
      className={`relative cursor-zoom-in overflow-hidden bg-slate-900 ${expanded ? 'h-full' : 'aspect-[4/3]'}`}
      onClick={() => setLightbox(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setLightbox(true)}
    >
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Annotated damage"
        className="hidden"
        onLoad={() => {
          setLoaded(true);
          setLoadError(false);
        }}
        onError={() => {
          setLoaded(false);
          setLoadError(true);
        }}
      />
      {loadError ? (
        <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-white/80">
          Could not load image preview.
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="h-full w-full object-contain"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        />
      )}
      <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/50 px-2 py-1 text-[10px] text-white">
        Click to enlarge
      </div>
    </div>
  );

  return (
    <div>
      <PreviewBody expanded={false} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap gap-2 text-[11px] text-slatey">
          {Object.entries(DAMAGE_COLORS).filter(([k]) => k !== 'default').slice(0, 5).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1 capitalize">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ background: c.fill, borderColor: c.stroke }} />
              {k}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <button type="button" className="rounded border border-slate-200 px-2 py-0.5 text-xs font-semibold text-navy hover:bg-slate-50" onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(2.5, z + 0.2)); }}>+</button>
          <button type="button" className="rounded border border-slate-200 px-2 py-0.5 text-xs font-semibold text-navy hover:bg-slate-50" onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(0.6, z - 0.2)); }}>−</button>
          <button type="button" className="rounded border border-slate-200 px-2 py-0.5 text-xs font-semibold text-navy hover:bg-slate-50" onClick={(e) => { e.stopPropagation(); setZoom(1); }}>Reset</button>
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(false)}
          role="presentation"
        >
          <div className="relative max-h-[95vh] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
            <PreviewBody expanded />
            <button type="button" className="absolute right-2 top-2 rounded-full bg-white px-3 py-1 text-sm font-bold text-navy shadow" onClick={() => setLightbox(false)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function downloadAnnotatedCanvas(canvas, filename = 'annotated-damage.png') {
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
