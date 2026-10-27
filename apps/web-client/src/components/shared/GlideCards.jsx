import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils.js';

const tones = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
};

function offsetIn(host, element) {
  const bounds = host.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return { x: rect.left - bounds.left - host.clientLeft, y: rect.top - bounds.top - host.clientTop, width: rect.width, height: rect.height };
}

export function GlideCards({ items, label, className }) {
  const hostRef = useRef(null);
  const layerRef = useRef(null);
  const glideRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const layer = layerRef.current;
    const glide = glideRef.current;
    if (!host || !layer || !glide || typeof ResizeObserver === 'undefined') return undefined;
    const tiles = Array.from(host.querySelectorAll('[data-glide-card]'));
    const controller = new AbortController();
    const { signal } = controller;
    let active = -1;
    let shown = false;

    const drawMask = () => {
      const shapes = tiles
        .map((tile) => {
          const box = offsetIn(host, tile);
          const radius = parseFloat(getComputedStyle(tile).borderTopLeftRadius) || 0;
          return `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${radius}"/>`;
        })
        .join('');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${host.scrollWidth}" height="${host.scrollHeight}">${shapes}</svg>`;
      const image = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
      layer.style.width = `${host.scrollWidth}px`;
      layer.style.height = `${host.scrollHeight}px`;
      layer.style.setProperty('mask-image', image);
      layer.style.setProperty('-webkit-mask-image', image);
    };

    const place = () => {
      const tile = tiles[active];
      if (!tile) return;
      const box = offsetIn(host, tile);
      if (!shown) glide.style.transition = 'opacity 180ms ease';
      glide.style.transform = `translate(${box.x}px, ${box.y}px)`;
      glide.style.width = `${box.width}px`;
      glide.style.height = `${box.height}px`;
      if (!shown) {
        void glide.offsetWidth;
        glide.style.transition = '';
        shown = true;
      }
      glide.dataset.visible = '';
    };

    const hide = () => {
      shown = false;
      delete glide.dataset.visible;
    };

    for (const type of ['pointerover', 'focusin']) {
      host.addEventListener(
        type,
        (event) => {
          const tile = event.target instanceof Element ? event.target.closest('[data-glide-card]') : null;
          const index = tile ? tiles.indexOf(tile) : -1;
          if (index < 0) return;
          if (!shown || index !== active) drawMask();
          active = index;
          place();
        },
        { signal },
      );
    }
    host.addEventListener('pointerleave', hide, { signal });
    host.addEventListener(
      'focusout',
      (event) => {
        const inside = event.relatedTarget instanceof Node && host.contains(event.relatedTarget);
        if (!inside && !host.matches(':hover')) hide();
      },
      { signal },
    );

    const reflow = new ResizeObserver(() => {
      if (!shown) return;
      drawMask();
      place();
    });
    reflow.observe(host);

    return () => {
      controller.abort();
      reflow.disconnect();
    };
  }, [items.length]);

  return (
    <div ref={hostRef} role="group" aria-label={label} className={cn('relative grid grid-cols-2 gap-2', className)}>
      <span ref={layerRef} className="glide-cards__layer" aria-hidden="true">
        <span ref={glideRef} className="glide-cards__glide" />
      </span>
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          data-glide-card=""
          className="flex min-w-0 flex-col items-start gap-3 rounded-2xl border bg-background p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tones[item.tone || 'primary'])}>
            <item.icon className="h-4 w-4" />
          </span>
          <span className="w-full min-w-0">
            <span className="block truncate text-sm font-semibold">{item.label}</span>
            {item.detail ? <span className="block truncate text-xs text-muted-foreground">{item.detail}</span> : null}
          </span>
        </Link>
      ))}
    </div>
  );
}
