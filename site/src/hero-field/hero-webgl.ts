// WebGL2 fallback: a GLSL ES 3.00 port of the three looks in hero-webgpu.ts. No deps.
// The maths mirrors the WGSL line for line so both backends look the same.
import { createRuntime, PLANT_SLOTS, type FrameState, type Handle, type Opts, type Renderer } from './common';
import { PALETTE } from './palette';
import { MASK_FEATHER, MASK_RADIUS } from './mask';

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  float x = float((gl_VertexID << 1) & 2);
  float y = float(gl_VertexID & 2);
  gl_Position = vec4(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  vUv = vec2(x, y);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes, uPointer, uVel;
uniform vec4 uPlants[${PLANT_SLOTS}];
uniform int uPlantN;
uniform float uTime, uProgress, uPresence;
uniform int uMode;
uniform vec3 uCanvas, uC0, uC1, uC2, uC3, uC4;
uniform vec4 uMask[4];
uniform vec4 uMaskK;
in vec2 vUv;
out vec4 o;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash21(i), b = hash21(i + vec2(1, 0)), c = hash21(i + vec2(0, 1)), e = hash21(i + vec2(1, 1));
  return mix(mix(a, b, w.x), mix(c, e, w.x), w.y);
}
float fbm(vec2 p, int octaves) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < octaves; i++) {
    v += amp * noise(p);
    p = vec2(p.x * 1.6 - p.y * 1.2, p.x * 1.2 + p.y * 1.6) + vec2(1.7, 9.2);
    amp *= 0.5;
  }
  return v;
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.x, p.y, p.x) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
// Animated Voronoi: F2 - F1, ~0 on the cell walls (where refracted light converges).
float vorEdge(vec2 p, float t) {
  vec2 i = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 h = hash22(i + g);
      vec2 o = 0.5 + 0.42 * sin(t * (0.55 + 0.5 * h.yx) + 6.2831 * h);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return sqrt(f2) - sqrt(f1);
}
vec3 caustics(vec2 p, float uvY, float t) {
  // Surface waves bend the cell walls; two nets at different scales and drifts interfere.
  vec2 q = p * 4.2;
  q += 0.5 * vec2(sin(q.y * 0.7 + t * 0.45) + 0.5 * sin(q.y * 1.9 - t * 0.31), sin(q.x * 0.6 - t * 0.38) + 0.5 * sin(q.x * 1.7 + t * 0.33));
  float e1 = vorEdge(q + vec2(t * 0.05, -t * 0.03), t * 0.9);
  vec2 q2 = vec2(q.x * 0.8 - q.y * 0.6, q.x * 0.6 + q.y * 0.8) * 1.7 + 13.1;
  float e2 = vorEdge(q2 + vec2(-t * 0.04, t * 0.06), t * 0.7);
  float l1 = exp(-e1 * 11.0), l2 = exp(-e2 * 13.0);
  float glow = exp(-e1 * 3.2);
  float hot = l1 * l2;                                    // crossings: light focuses
  // Light shafts from above: slow broad bands that modulate the net.
  float ang = p.x + p.y * 0.45;
  float shaft = 0.6 + 0.4 * sin(ang * 2.6 + t * 0.12) * sin(ang * 1.3 - t * 0.09 + 1.7);
  float shade = smoothstep(0.08, 0.45, e1);              // cell interiors, away from the light
  vec3 ground = mix(uC0, uC1, smoothstep(0.0, 1.0, uvY));
  vec3 col = mix(ground, uC4, shade * 0.55);
  col = mix(col, uC2, clamp(glow * 0.55 * shaft, 0.0, 1.0));
  col = mix(col, uC2, clamp((l1 * 0.9 + l2 * 0.55) * shaft, 0.0, 1.0));
  col = mix(col, uC3, clamp((pow(l1, 2.2) * 0.8 + hot * 1.6) * shaft, 0.0, 1.0));
  return col;
}
vec3 inkwash(vec2 p, float aspect, float t, vec2 ptr, float presence) {
  vec2 dv = p - ptr;
  float rad = 0.3 * aspect;
  float infl = exp(-dot(dv, dv) / (rad * rad * 0.5)) * presence;
  vec2 q = p + dv * infl * 0.35;
  // Far layer: one broad, slow cloud (depth); it is also one axis of the warp.
  float back = fbm(q * 1.15 + vec2(t * 0.045, -t * 0.025) + 3.7, 3);
  // Near layer: a warped field that billows (the warp itself evolves with time).
  vec2 a = q * 1.9 + vec2(-t * 0.06, t * 0.035);
  float w1 = fbm(a * 1.2 + vec2(5.2 + t * 0.07, 1.3 - t * 0.05), 3);
  float n = fbm(a + vec2(w1 - 0.5, back - 0.5) * 2.6, 4);
  float edge = smoothstep(0.25, 0.95, length(vec2(p.x / aspect * 1.6, p.y * 1.5)));
  float dens = n + edge * 0.1 + infl * 0.12;
  float far = smoothstep(0.4, 0.7, back + edge * 0.15);
  float aa = fwidth(dens) * 1.5 + 0.004;
  float body = smoothstep(0.46 - aa, 0.46 + aa + 0.01, dens);
  float core = smoothstep(0.49, 0.74, dens);
  float rim = body * (1.0 - smoothstep(0.0, 0.05 + aa, dens - 0.46));
  // Wisps: ridges of the warp field just outside the ink, tendrils reaching into clear water.
  float ridge = 1.0 - abs(w1 * 2.0 - 1.0);
  float wisp = smoothstep(0.88, 0.98, ridge) * smoothstep(0.3, 0.46, dens) * (1.0 - body);
  // Sheen: a lighter band through the dense ink, following the warp (volume).
  float sheen = smoothstep(0.55, 0.9, w1) * core;
  vec3 col = uC0;
  col = mix(col, uC1, far * 0.85);
  col = mix(col, uC4, far * smoothstep(0.6, 0.85, back) * 0.4);
  col = mix(col, uC2, max(body * 0.9, wisp * 0.6));
  col = mix(col, uC3, core * 0.9);
  col = mix(col, uC3, rim * 0.6);
  col = mix(col, uC4, sheen * 0.35);
  return col;
}
// One planted sprout (see hero-webgpu.ts): returns (body, halo, core, tip + ripple) × visibility.
const float PLANT_R = 0.17;
vec4 sprout(vec2 p, vec4 pl, float aspect, float px, float n) {
  vec2 c = vec2((pl.x - 0.5) * aspect, 0.5 - pl.y);
  vec2 rel = p - c;
  float r2 = dot(rel, rel);
  float sc = min(1.0, 0.45 + aspect * 0.6);
  float rMax = PLANT_R * 1.15 * 1.25 * sc;
  if (r2 >= rMax * rMax) return vec4(0.0);
  float r = sqrt(r2);
  float h = hash21(vec2(pl.x, pl.y) * 917.3);
  float R = PLANT_R * (0.85 + 0.3 * h) * sc;
  float age = pl.z;
  float h2 = hash21(vec2(pl.y, pl.x) * 613.7 + 4.1);
  float k = clamp(age / 1.8, 0.0, 1.0);
  float grow = 1.0 - (1.0 - k) * (1.0 - k) * (1.0 - k);
  float N1 = 5.0 + floor(h2 * 2.99);
  float seg = 6.2831853 / N1;
  float r0 = r / R;
  float th = atan(rel.y, rel.x) + (n - 0.5) * 1.2 * r0 + sin(r0 * 5.0 + h * 6.2831) * 0.24 * r0 + h2 * 6.2831;
  float local = (fract(th / seg) - 0.5) * seg;
  float lenK = (0.55 + 0.45 * hash21(vec2(floor(th / seg), h * 37.1))) * (0.8 + 0.3 * clamp(rel.y / max(r, 1e-4), 0.0, 1.0));
  float Rs = R * lenK;
  float rn = r / Rs;
  float front = Rs * grow * (0.9 + 0.2 * n);
  float d1 = seg * 0.27 * smoothstep(0.28, 0.95, rn);
  float d2 = seg * 0.085 * smoothstep(0.62, 1.0, rn);
  float dist = abs(abs(abs(local) - d1) - d2) * r;
  float aa = px * 1.2;
  float w = R * mix(0.055, 0.011, clamp(rn, 0.0, 1.0)) + px * 0.4;
  float reveal = smoothstep(front + aa, front - Rs * 0.06, r);
  float kb = clamp(age / 0.35, 0.0, 1.0);
  float bulbR = R * 0.07 * min(kb * 1.6, 1.0) * (1.0 + 0.3 * sin(kb * 3.14159));
  float bulb = 1.0 - smoothstep(bulbR - aa, bulbR + aa, r);
  float body = max((1.0 - smoothstep(w - aa, w + aa, dist)) * reveal, bulb);
  float halo = max((1.0 - smoothstep(w, w * 3.5 + aa, dist)) * reveal, bulb);
  float fresh = 1.0 - smoothstep(1.2, 3.0, age);
  float core = max((1.0 - smoothstep(0.0, w * 0.5 + px * 0.5, dist)) * reveal, bulb * 0.8) * (0.35 + 0.65 * fresh);
  float fd = (r - front) / (Rs * 0.09);
  float tip = exp(-fd * fd) * (1.0 - smoothstep(w, w * 2.6 + aa, dist)) * fresh * step(0.02, grow);
  float kr = clamp(age / 0.7, 0.0, 1.0);
  float ringR = R * 1.2 * (1.0 - (1.0 - kr) * (1.0 - kr) * (1.0 - kr));
  float rd = (r - ringR) / (px * 2.5);
  float ring = exp(-rd * rd) * (1.0 - kr) * 0.7;
  float vis = pl.w * (0.75 + 0.25 * fresh);
  return vec4(body, halo, core, clamp(tip + ring, 0.0, 1.0)) * vis;
}
vec3 growth(vec2 p0, float aspect, float px, float t, float progress, vec2 ptr, vec2 vel, float presence, float guard) {
  vec2 dv = p0 - ptr;
  float r2 = dot(dv, dv);
  float infl = exp(-r2 / (0.24 * 0.24)) * presence;
  float drag = exp(-r2 / (0.3 * 0.3)) * presence;
  vec2 vp = vec2(vel.x * aspect, -vel.y);
  vec2 p = p0 + dv * (0.55 * infl) - vp * (0.06 * drag);
  float tt = t * 0.03;
  vec2 seed = vec2(0.0, -0.62);
  vec2 q = p * 2.0 + vec2(tt, tt * 0.6);
  float big = fbm(q * 0.55 + vec2(3.1, 7.7), 3);
  float n = fbm(q + vec2(big - 0.5, 0.5 - big) * 1.6, 4);
  float rn = fbm(q * 1.4 + vec2(big, -big) * 1.2 + 11.0, 3);
  float aa = fwidth(n);
  float fb = fwidth(big);
  // Back layer: soft, dim veins from the large field at offset levels (depth).
  float lvlB = abs(fract(big * 5.0 + 0.25) - 0.5) / 5.0;
  float backV = 1.0 - smoothstep(0.0, fb * 16.0 + 0.012, lvlB);
  // Trunks: tube-shaded contour lines with a shadow halo.
  float lvlT = abs(fract(big * 3.0 + 0.5) - 0.5) / 3.0;
  float wT = (fb * 6.0 + 0.011) * (1.0 + 0.45 * infl);
  float trunk = 1.0 - smoothstep(wT * 0.7, wT, lvlT);
  float halo = 1.0 - smoothstep(wT, wT * 3.2, lvlT);
  float core = 1.0 - smoothstep(0.0, wT * 0.45, lvlT);
  float lvlC = abs(fract(n * 7.0 + 0.5) - 0.5) / 7.0;
  float wC = (aa * 1.8 + 0.003) * (1.0 + 0.9 * infl);
  float cap = 1.0 - smoothstep(wC * 0.4, wC, lvlC);
  float ra = fwidth(rn) * 1.5 + 0.003;
  float ridge = smoothstep(0.93 - ra, 0.935 + ra, 1.0 - abs(rn * 2.0 - 1.0));
  vec2 rel = p - seed;
  float d0 = length(vec2(rel.x * 1.5, rel.y));
  float dist = d0 + (n - 0.5) * 0.9 + (big - 0.5) * 0.4 - infl * 0.3;
  float reach = progress * 2.0 + sin(t * 0.7) * 0.02 * progress;
  float grown = smoothstep(reach, reach - 0.18, dist);
  float along = clamp(dist / reach, 0.0, 1.0);
  vec3 veinCol = mix(uC2, uC3, along);
  float pool = smoothstep(0.45, 0.8, big);
  float tip = smoothstep(reach - 0.5, reach - 0.08, dist) * grown;
  vec3 col = mix(uC0, uC1, pool * 0.75 * grown);
  col = mix(col, mix(uC1, uC2, 0.45), backV * 0.55 * grown);
  col = mix(col, uC2 * 0.55, halo * 0.22 * grown);
  col = mix(col, mix(uC3, veinCol, 0.5), ridge * grown);
  col = mix(col, veinCol, cap * 0.85 * grown);
  col = mix(col, mix(uC2, uC3, along * 0.6), trunk * grown);
  col = mix(col, uC4, core * 0.55 * grown);
  float vein = max(trunk, max(cap * 0.85, ridge));
  col = mix(col, uC4, tip * (0.3 + vein * 0.7));
  col = mix(col, uC4, vein * infl * 0.35 * grown);
  vec4 sp = vec4(0.0);
  for (int i = 0; i < ${PLANT_SLOTS}; i++) { if (i >= uPlantN) break; sp = max(sp, sprout(p, uPlants[i], aspect, px, n)); }
  col = mix(col, uC2 * 0.55, sp.y * 0.3);
  col = mix(col, mix(uC2, uC3, 0.6), sp.x * 0.92);
  col = mix(col, uC4, sp.z * 0.7 * guard);
  col = mix(col, uC4, sp.w * guard);
  return col;
}
// Soft capsule protection: k inside, gaussian fade over FEATHER outside, so the zones read as one glow, not boxes.
float rectMask(vec2 p, vec4 r, float k, float aspect) {
  vec2 c = vec2(((r.x + r.z) * 0.5 - 0.5) * aspect, 0.5 - (r.y + r.w) * 0.5);
  vec2 hs = vec2((r.z - r.x) * 0.5 * aspect, (r.w - r.y) * 0.5);
  float rad = min(${MASK_RADIUS}, min(hs.x, hs.y));
  vec2 q = abs(p - c) - (hs - rad);
  float d = max(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad, 0.0);
  float F = ${MASK_FEATHER} * min(1.0, aspect * 0.85);
  return k * exp(-d * d / (F * F * 0.33));
}
vec3 encode(vec3 c) {
  vec3 hiPart = pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055;
  return mix(hiPart, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2((vUv.x - 0.5) * aspect, 0.5 - vUv.y);
  vec2 ptr = vec2((uPointer.x - 0.5) * aspect, 0.5 - uPointer.y);
  float m = 1.0 - (1.0 - rectMask(p, uMask[0], uMaskK.x, aspect)) * (1.0 - rectMask(p, uMask[1], uMaskK.y, aspect))
                * (1.0 - rectMask(p, uMask[2], uMaskK.z, aspect)) * (1.0 - rectMask(p, uMask[3], uMaskK.w, aspect));
  vec3 col;
  if (uMode == 0) col = caustics(p, vUv.y, uTime);
  else if (uMode == 1) col = inkwash(p, aspect, uTime, ptr, uPresence);
  else col = growth(p, aspect, 1.0 / uRes.y, uTime, uProgress, ptr, uVel, uPresence, 1.0 - m);
  // Soft union of the protection zones, computed above.
  col = mix(col, uCanvas, m);
  o = vec4(encode(col), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader compile failed');
  return sh;
}

export async function mount(canvas: HTMLCanvasElement, opts: Opts): Promise<Handle | null> {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed');
  gl.useProgram(prog);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const loc = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = loc('uRes'), uPointer = loc('uPointer'), uTime = loc('uTime'), uProgress = loc('uProgress'),
    uPresence = loc('uPresence'), uMode = loc('uMode'), uCanvas = loc('uCanvas'), uMask = loc('uMask[0]'), uMaskK = loc('uMaskK'), uVel = loc('uVel'), uPlants = loc('uPlants[0]'), uPlantN = loc('uPlantN');
  const uC = [loc('uC0'), loc('uC1'), loc('uC2'), loc('uC3'), loc('uC4')];

  // Pack the palette once so the per-frame path allocates nothing: [theme][mode] -> 5 colours + canvas.
  const CONCEPTS = ['caustics', 'inkwash', 'growth'] as const;
  const packed = Object.fromEntries(Object.entries(PALETTE).map(([k, p]) => [k, {
    canvas: new Float32Array(p.canvas),
    modes: CONCEPTS.map((c) => p[c].map((v) => new Float32Array(v))),
  }])) as Record<FrameState['theme'], { canvas: Float32Array; modes: Float32Array[][] }>;

  // GPU timing when the (rarely exposed) timer extension exists; one query in flight.
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  let query: WebGLQuery | null = null;
  let gpuMs: number | undefined;
  const pollQuery = () => {
    if (!ext || !query) return false;
    if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return true;
    if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpuMs = Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6;
    gl.deleteQuery(query); query = null;
    return false;
  };

  const renderer: Renderer = {
    resize(w, h) { gl.viewport(0, 0, w, h); },
    draw(s: FrameState) {
      if (gl.isContextLost()) return;
      const pal = packed[s.theme];
      const cols = pal.modes[s.mode];
      const timing = ext && !pollQuery();
      if (timing) { query = gl.createQuery(); gl.beginQuery(ext!.TIME_ELAPSED_EXT, query!); }
      gl.uniform2f(uRes, s.w, s.h);
      gl.uniform2f(uPointer, s.px, s.py);
      gl.uniform2f(uVel, s.vx, s.vy);
      gl.uniform4fv(uPlants, s.plants);
      gl.uniform1i(uPlantN, s.plantN);
      gl.uniform1f(uTime, s.time);
      gl.uniform1f(uProgress, s.progress);
      gl.uniform1f(uPresence, s.presence);
      gl.uniform1i(uMode, s.mode);
      gl.uniform3fv(uCanvas, pal.canvas);
      for (let i = 0; i < 5; i++) gl.uniform3fv(uC[i], cols[i]);
      gl.uniform4fv(uMask, s.mask);
      gl.uniform4fv(uMaskK, s.maskK);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (timing) gl.endQuery(ext!.TIME_ELAPSED_EXT);
    },
    gpuMs: () => gpuMs,
    destroy() {
      gl.deleteProgram(prog);
      gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
  return createRuntime(canvas, opts, 'webgl2', renderer);
}
