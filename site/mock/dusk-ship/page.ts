// Mock page: mounts the dusk scene (with the ship), switches cameras and themes, and feeds the contrast mask from the
// rough overlay (the headline, lede, buttons of each site). Nothing here ships to either site.
import { mount } from '../../src/hero/dusk/scene';
import type { Camera, Handle, Rect, Theme } from '../../src/hero/dusk/scene';

const q = new URLSearchParams(location.search);
const html = document.documentElement, body = document.body;
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const canvas = $<HTMLCanvasElement>('#c'), stat = $('#stat'), poster = $<HTMLImageElement>('#poster');
let cam: Camera = (['wide', 'raft', 'sky'].includes(q.get('cam') ?? '') ? q.get('cam') : 'wide') as Camera;
let theme: Theme = q.get('theme') === 'light' ? 'light' : 'dark';
body.dataset.cam = cam; body.dataset.overlay = q.get('overlay') === '0' ? '0' : '1'; body.dataset.ui = q.get('ui') === '0' ? '0' : '1';
body.dataset.boxes = q.get('boxes') === '1' ? '1' : '0';
html.dataset.theme = theme;
const reduced = q.get('reduced') === '1';

// the buttons carry their own fill, so their zone is light here: a strong one would wash the ship that sits behind them
const MASK_K = { light: { h1: 0.3, lede: 0.55, ctl: 0.1 }, dark: { h1: 0.4, lede: 0.82, ctl: 0.16 } } as const;
function textBox(el: Element): DOMRect { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return b.width ? b : el.getBoundingClientRect(); }
function rects(): Rect[] {
  if (q.get('nomask') === '1') return [];
  const cr = canvas.getBoundingClientRect(); if (!cr.width) return [];
  const K = MASK_K[theme], out: Rect[] = [];
  out.push({ x0: -1, y0: -1, x1: 2, y1: (64 * 0.9) / cr.height, k: theme === 'dark' ? 0.45 : 0.5 }); // nav
  const root = document.querySelector(`.ov.${cam}`)!;
  const add = (sel: 'h1' | 'lede' | 'ctl', pad: number, el = root.querySelector(`[data-mask=${sel}]`)) => {
    if (!el) return;
    const b = sel === 'ctl' ? el.getBoundingClientRect() : textBox(el);
    out.push({ x0: (b.left - pad - cr.left) / cr.width, y0: (b.top - pad - cr.top) / cr.height, x1: (b.right + pad - cr.left) / cr.width, y1: (b.bottom + pad - cr.top) / cr.height, k: K[sel] });
  };
  add('h1', 12); add('lede', 12); add('ctl', 6);
  return out.slice(0, 4);
}
function boxes() {
  // dashed outline of the zones the site protects (h1, lede, buttons, terminal), for judging composition
  const host = $('#boxes'); host.style.cssText = 'position:absolute;inset:0;display:block;border:0';
  host.innerHTML = '';
  const root = document.querySelector(`.ov.${cam}`)!;
  for (const el of root.querySelectorAll('[data-mask],[data-term]')) {
    const b = el.getBoundingClientRect(); const d = document.createElement('div'); d.className = 'box';
    d.style.cssText = `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px`; host.append(d);
  }
}
let handle: Handle | null = null;
const refresh = (animate = true) => { requestAnimationFrame(() => { handle?.setMask(rects(), { animate }); if (body.dataset.boxes === '1') boxes(); }); };

function ui() {
  for (const b of document.querySelectorAll<HTMLButtonElement>('button[data-cam]')) b.setAttribute('aria-pressed', String(b.dataset.cam === cam));
  for (const b of document.querySelectorAll<HTMLButtonElement>('button[data-theme]')) b.setAttribute('aria-pressed', String(b.dataset.theme === theme));
  $('#ov').setAttribute('aria-pressed', String(body.dataset.overlay === '1'));
}
function setCam(c: Camera, animate = true) { cam = c; body.dataset.cam = c; handle?.setCamera(c, { animate }); refresh(animate); ui(); }
function setTheme(t: Theme) { theme = t; html.dataset.theme = t; handle?.setTheme(t); poster.src = posterFor(); refresh(true); ui(); }
const posterFor = () => `./posters/dusk-${cam}-${theme}-${innerWidth <= 600 ? 390 : 1440}.webp`;

for (const b of document.querySelectorAll<HTMLButtonElement>('button[data-cam]')) b.onclick = () => setCam(b.dataset.cam as Camera);
for (const b of document.querySelectorAll<HTMLButtonElement>('button[data-theme]')) b.onclick = () => setTheme(b.dataset.theme as Theme);
$('#ov').onclick = () => { body.dataset.overlay = body.dataset.overlay === '1' ? '0' : '1'; ui(); };
$('#glide').onclick = () => { setCam('wide', false); setTimeout(() => setCam('raft'), 900); setTimeout(() => setCam('wide'), 3600); };
addEventListener('keydown', (e) => { if (e.key === 'b') { body.dataset.boxes = body.dataset.boxes === '1' ? '0' : '1'; boxes(); } });
addEventListener('resize', () => refresh(false));

poster.src = posterFor();
if (q.get('static') === '1') { $('#stage').dataset.backend = 'static'; stat.textContent = 'static poster (?static=1)'; } else
mount(canvas, {
  camera: cam, theme, reduced, host: $('#stage'), mask: rects(),
  maxDpr: Number(q.get('dpr')) || undefined, maxFps: Number(q.get('fps')) || undefined,
  budgetMs: q.get('adaptive') === '0' ? 1e9 : undefined, adaptive: q.get('adaptive') === '0' ? false : undefined,
  onStats: (s) => { stat.textContent = `${s.fps} fps  gpu ${s.gpuMs?.toFixed(1) ?? '-'} ms  ${s.w}x${s.h}  x${s.scale.toFixed(2)}`; },
}).then((h) => {
  handle = h; (window as unknown as { __dusk: Handle }).__dusk = h; body.dataset.backend = h.backend; $('#stage').dataset.backend = h.backend;
  if (h.backend === 'static') stat.textContent = 'no WebGPU: poster';
  document.fonts?.ready.then(() => refresh(false));
  refresh(false); if (body.dataset.boxes === '1') boxes();
}).catch((e) => { console.error(e); $('#stage').dataset.backend = 'static'; });
ui();
Object.assign(window, { __cam: setCam, __theme: setTheme });
