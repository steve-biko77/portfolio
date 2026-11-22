"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Lensflare, LensflareElement } from "three/examples/jsm/objects/Lensflare.js";

/**
 * Fixed full-screen 3D backdrop. One camera flies through a spiral galaxy, stopping
 * beside a planet per page section and warping (stars -> streaks) between them.
 * Everything heavy lives on the GPU: stars/galaxy are static buffers moved by shaders.
 */

export const STATION_IDS = ["top", "about", "projects", "testimonials", "experience", "approach", "contact"];

const STEP = 70; // distance between stations
const NOISE = /* glsl */ `
float hash(vec3 p){p=fract(p*0.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p*=2.03;a*=.5;}return s;}
`;

type PlanetSpec = {
    name: string;
    kind: "earth" | "tex" | "sun";
    tex?: string;
    fallback: string;
    atmo: string;
    atmoPow: number;
    atmoScale: number;
    size: number;
    sun?: [number, number, number];
    ring?: boolean;
    moon?: boolean;
    tilt?: number;
    spin: number;
};

const PLANETS: PlanetSpec[] = [
    { name: "Terre", kind: "earth", fallback: "#1f4f8f", atmo: "#5aa8ff", atmoPow: 2.2, atmoScale: 1.13, size: 1, sun: [-0.9, 0.22, 0.28], moon: true, spin: 0.012 },
    { name: "Mars", kind: "tex", tex: "mars", fallback: "#b0522b", atmo: "#ff9a66", atmoPow: 3, atmoScale: 1.07, size: 0.62, spin: 0.02 },
    { name: "Jupiter", kind: "tex", tex: "jupiter", fallback: "#c9a27a", atmo: "#e8cfa8", atmoPow: 3, atmoScale: 1.05, size: 1.35, spin: 0.03 },
    { name: "Saturne", kind: "tex", tex: "saturn", fallback: "#d8c28a", atmo: "#f0dca8", atmoPow: 3, atmoScale: 1.05, size: 1.0, ring: true, tilt: 0.42, spin: 0.028 },
    { name: "Uranus", kind: "tex", tex: "uranus", fallback: "#8fd6e0", atmo: "#9fe8f0", atmoPow: 2.4, atmoScale: 1.1, size: 0.9, spin: 0.02 },
    { name: "Neptune", kind: "tex", tex: "neptune", fallback: "#2f56d6", atmo: "#5f86ff", atmoPow: 2.4, atmoScale: 1.1, size: 0.9, spin: 0.02 },
    { name: "Soleil", kind: "sun", tex: "sun", fallback: "#ff8a20", atmo: "#ff9340", atmoPow: 2, atmoScale: 1.5, size: 1.3, spin: 0.01 },
];

const PLANET_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
void main(){
  vUv = uv;
  vWN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const TEX_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
uniform sampler2D uMap; uniform float uHas, uRot; uniform vec3 uFallback, uAtmo, uSun;
void main(){
  vec2 uv = vec2(vUv.x + uRot, vUv.y);
  vec3 col = uHas > .5 ? texture2D(uMap, uv).rgb : uFallback;
  vec3 n = normalize(vWN); vec3 v = normalize(cameraPosition - vWP);
  float d = dot(n, normalize(uSun));
  float lit = smoothstep(-.1, .6, d);
  float ndv = max(dot(n, v), 0.);
  float limb = .55 + .45 * pow(ndv, .5);
  vec3 outc = col * (.03 + lit * 1.2) * limb;
  float rim = pow(1. - ndv, 3.);
  outc += uAtmo * rim * lit * .5;
  float tw = exp(-pow(d * 4.5, 2.));
  outc += vec3(1., .45, .15) * tw * rim * .3;
  gl_FragColor = vec4(outc, 1.);
}`;

const EARTH_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
uniform sampler2D uDay, uNight, uSpec, uClouds;
uniform float uHas, uRot, uTime; uniform vec3 uSun, uFallback;
void main(){
  vec2 uv = vec2(vUv.x + uRot, vUv.y);
  vec3 day = uHas > .5 ? texture2D(uDay, uv).rgb : uFallback;
  vec3 night = uHas > .5 ? texture2D(uNight, uv).rgb : vec3(0.);
  float spec = uHas > .5 ? texture2D(uSpec, uv).r : 0.;
  float cl = uHas > .5 ? texture2D(uClouds, vec2(uv.x + uTime * .0025, uv.y)).r : 0.;
  vec3 n = normalize(vWN), v = normalize(cameraPosition - vWP), s = normalize(uSun);
  float d = dot(n, s);
  float lit = smoothstep(-.08, .55, d);
  float ndv = max(dot(n, v), 0.);
  cl = smoothstep(.32, 1., cl) * .75;
  vec3 surf = mix(day, vec3(.95, .97, 1.), cl);
  vec3 dayc = surf * (.02 + lit * 1.25);
  vec3 r = reflect(-s, n);
  dayc += vec3(1., .95, .85) * pow(max(dot(r, v), 0.), 55.) * spec * (1. - cl) * 1.5 * lit;
  float nightMask = pow(1. - smoothstep(-.18, .12, d), 1.5);
  vec3 lights = night * vec3(1., .78, .5) * 1.9 * nightMask * (1. - cl * .7);
  float rim = pow(1. - ndv, 3.);
  vec3 atm = vec3(.35, .62, 1.) * rim * (.12 + lit * 1.1);
  float tw = exp(-pow(d * 4., 2.));
  vec3 twc = vec3(1., .5, .2) * tw * (.2 + rim * .9);
  gl_FragColor = vec4(dayc + lights + atm + twc * .55, 1.);
}`;

const SUN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
uniform sampler2D uMap; uniform float uHas, uTime; uniform vec3 uFallback;
void main(){
  vec3 n = normalize(vWN); vec3 v = normalize(cameraPosition - vWP);
  float ndv = max(dot(n, v), 0.);
  vec2 a = vec2(vUv.x + uTime * .004, vUv.y);
  vec2 b = vec2(vUv.x * 1.3 - uTime * .006, vUv.y * 1.1 + .03);
  vec3 c1 = uHas > .5 ? texture2D(uMap, a).rgb : uFallback;
  vec3 c2 = uHas > .5 ? texture2D(uMap, b).rgb : uFallback;
  vec3 col = mix(c1, c2, .45) * vec3(1.25, .82, .42) + vec3(.22, .05, 0.);
  col *= .55 + .45 * pow(ndv, .7);
  gl_FragColor = vec4(col, 1.);
}`;

const ATMO_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vWN; varying vec3 vVP;
void main(){
  vN = normalize(normalMatrix * normal);
  vWN = normalize(mat3(modelMatrix) * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  vVP = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const ATMO_FRAG = /* glsl */ `
varying vec3 vN; varying vec3 vWN; varying vec3 vVP;
uniform vec3 uColor, uSun; uniform float uPow, uK, uTwi;
void main(){
  float c = clamp(-dot(normalize(vN), normalize(-vVP)) / uK, 0., 1.);
  float i = pow(c, uPow);
  float sd = dot(normalize(vWN), normalize(uSun));
  float day = smoothstep(-.4, .5, sd);
  float tw = exp(-pow(sd * 3., 2.)) * uTwi;
  vec3 col = mix(uColor, vec3(1., .5, .18), tw * .8);
  float a = i * (.1 + day * .9 + tw * .5);
  gl_FragColor = vec4(col * a * 1.7, a);
}`;

const RING_VERT = /* glsl */ `
varying float vR; varying vec3 vWP;
void main(){ vR = length(position.xy); vec4 wp = modelMatrix * vec4(position, 1.); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const RING_FRAG = /* glsl */ `
precision highp float;
varying float vR; varying vec3 vWP;
uniform sampler2D uRing; uniform float uHas, uIn, uOut, uPR; uniform vec3 uCenter, uSun;
void main(){
  float t = (vR - uIn) / (uOut - uIn);
  vec4 tex = uHas > .5 ? texture2D(uRing, vec2(t, .5)) : vec4(.8, .7, .55, .45 * smoothstep(0., .1, t));
  vec3 s = normalize(uSun);
  vec3 pc = uCenter - vWP;
  float tp = dot(pc, s);
  float dist = length(pc - s * tp);
  float sh = tp > 0. ? mix(.08, 1., smoothstep(uPR * .94, uPR * 1.04, dist)) : 1.;
  gl_FragColor = vec4(tex.rgb * sh * 1.1, tex.a * .95);
}`;

const STAR_VERT = /* glsl */ `
attribute vec3 aCol; attribute float aSize; attribute float aEnd;
uniform float uCamZ, uSpan, uWarp, uScale, uMaxPx; uniform vec3 uCamXY;
varying vec3 vCol; varying float vA;
void main(){
  float z = mod(position.z - uCamZ, uSpan) - uSpan;           // [-span,0) ahead of the camera
  vec3 w = vec3(position.x + uCamXY.x, position.y + uCamXY.y, uCamZ + z);
  float len = uWarp * (.6 + aSize * 2.2);
  w.z -= aEnd * len;                                          // tail trails behind the motion
  vec4 mv = viewMatrix * vec4(w, 1.);
  float dist = max(-mv.z, .1);
  float fade = smoothstep(2., 26., dist) * (1. - smoothstep(uSpan * .55, uSpan, dist));
  vCol = aCol;
  vA = fade * (1. - aEnd * .92);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / dist, 1., uMaxPx);
}`;
const POINT_FRAG = /* glsl */ `
precision mediump float; varying vec3 vCol; varying float vA; uniform float uDim;
void main(){ vec2 c = gl_PointCoord - .5; float r = length(c); if(r > .5) discard;
  float a = smoothstep(.5, .0, r) * vA * uDim; gl_FragColor = vec4(vCol, a); }`;
const LINE_FRAG = /* glsl */ `
precision mediump float; varying vec3 vCol; varying float vA; uniform float uLine;
void main(){ gl_FragColor = vec4(vCol, vA * uLine); }`;

const GAL_VERT = /* glsl */ `
attribute vec3 aCol; attribute float aSize; uniform float uScale, uMaxPx; varying vec3 vCol;
void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(-mv.z, 1.), 1., uMaxPx); }`;
const GAL_FRAG = /* glsl */ `
precision mediump float; varying vec3 vCol; uniform float uAlpha;
void main(){ float r = length(gl_PointCoord - .5); if(r > .5) discard; gl_FragColor = vec4(vCol, smoothstep(.5,.0,r) * uAlpha); }`;

const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

function glowTexture(stops: [number, string][]) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const g = cv.getContext("2d")!;
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export default function GalaxyScene({ onFail }: { onFail?: () => void }) {
    const host = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = host.current;
        if (!el) return;

        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
        } catch {
            onFail?.();
            return;
        }

        const mobile = window.innerWidth < 768;
        const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let dpr = Math.min(window.devicePixelRatio || 1, mobile || lowEnd ? 1.25 : 1.5);
        renderer.setPixelRatio(dpr);
        renderer.setClearColor(0x000319, 1);
        el.appendChild(renderer.domElement);
        renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1400);
        const disposables: { dispose: () => void }[] = [];
        const track = <T extends { dispose: () => void }>(o: T) => (disposables.push(o), o);

        // ---------- Stars (dots + warp streaks) ----------
        const N = mobile || lowEnd ? 1500 : 3000;
        const SPAN = 280;
        const pos = new Float32Array(N * 3);
        const col = new Float32Array(N * 3);
        const size = new Float32Array(N);
        const palette = [[1, 1, 1], [1, 1, 1], [.7, .85, 1], [.82, .72, 1], [1, .85, .7]];
        for (let i = 0; i < N; i++) {
            const r = 7 + Math.pow(Math.random(), 0.75) * 80;
            const a = Math.random() * Math.PI * 2;
            pos.set([Math.cos(a) * r, Math.sin(a) * r * 0.62, Math.random() * SPAN], i * 3);
            col.set(palette[(Math.random() * palette.length) | 0], i * 3);
            size[i] = 0.12 + Math.random() * 0.5;
        }
        const uni = {
            uCamZ: { value: 0 }, uSpan: { value: SPAN }, uWarp: { value: 0 }, uScale: { value: 1 },
            uMaxPx: { value: 4 }, uCamXY: { value: new THREE.Vector3() }, uDim: { value: 1 }, uLine: { value: 0 },
        };
        const pg = track(new THREE.BufferGeometry());
        pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        pg.setAttribute("aCol", new THREE.BufferAttribute(col, 3));
        pg.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
        pg.setAttribute("aEnd", new THREE.BufferAttribute(new Float32Array(N), 1));
        const pm = track(new THREE.ShaderMaterial({
            vertexShader: STAR_VERT, fragmentShader: POINT_FRAG, uniforms: uni,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        const points = new THREE.Points(pg, pm);
        points.frustumCulled = false;
        scene.add(points);

        const lg = track(new THREE.BufferGeometry());
        const lp = new Float32Array(N * 6), lc = new Float32Array(N * 6), ls = new Float32Array(N * 2), le = new Float32Array(N * 2);
        for (let i = 0; i < N; i++) {
            for (let k = 0; k < 2; k++) {
                lp.set(pos.subarray(i * 3, i * 3 + 3), (i * 2 + k) * 3);
                lc.set(col.subarray(i * 3, i * 3 + 3), (i * 2 + k) * 3);
                ls[i * 2 + k] = size[i];
                le[i * 2 + k] = k;
            }
        }
        lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
        lg.setAttribute("aCol", new THREE.BufferAttribute(lc, 3));
        lg.setAttribute("aSize", new THREE.BufferAttribute(ls, 1));
        lg.setAttribute("aEnd", new THREE.BufferAttribute(le, 1));
        const lm = track(new THREE.ShaderMaterial({
            vertexShader: STAR_VERT, fragmentShader: LINE_FRAG, uniforms: uni,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        const lines = new THREE.LineSegments(lg, lm);
        lines.frustumCulled = false;
        scene.add(lines);

        // ---------- Spiral galaxy ----------
        const GN = mobile || lowEnd ? 14000 : 30000;
        const gp = new Float32Array(GN * 3), gc = new Float32Array(GN * 3), gs = new Float32Array(GN);
        const R = 320, ARMS = 3, TWIST = 5.4;
        const core = new THREE.Color("#ffb86b"), mid = new THREE.Color("#c18cff"), edge = new THREE.Color("#5f8dff");
        const tmp = new THREE.Color();
        for (let i = 0; i < GN; i++) {
            const u = Math.random();
            const r = Math.pow(u, 1.7) * R;
            const arm = (i % ARMS) * ((Math.PI * 2) / ARMS);
            const spread = (Math.random() - 0.5) * (10 + r * 0.22) * (Math.random() + 0.3);
            const ang = arm + (r / R) * TWIST + spread * 0.02;
            const x = Math.cos(ang) * r + (Math.random() - 0.5) * (5 + r * 0.16);
            const z = Math.sin(ang) * r + (Math.random() - 0.5) * (5 + r * 0.16);
            const y = (Math.random() - 0.5) * (26 * Math.exp(-r / 100) + 3);
            gp.set([x, y, z], i * 3);
            const t = r / R;
            tmp.copy(core).lerp(mid, smooth(0, 0.5, t)).lerp(edge, smooth(0.45, 1, t));
            const br = 0.55 + Math.random() * 0.6;
            gc.set([tmp.r * br, tmp.g * br, tmp.b * br], i * 3);
            gs[i] = 1.6 + Math.random() * 3.4 + (1 - t) * 2.6;
        }
        const gg = track(new THREE.BufferGeometry());
        gg.setAttribute("position", new THREE.BufferAttribute(gp, 3));
        gg.setAttribute("aCol", new THREE.BufferAttribute(gc, 3));
        gg.setAttribute("aSize", new THREE.BufferAttribute(gs, 1));
        const gu = { uScale: { value: 1 }, uMaxPx: { value: 7 }, uAlpha: { value: 0.55 } };
        const gm = track(new THREE.ShaderMaterial({
            vertexShader: GAL_VERT, fragmentShader: GAL_FRAG, uniforms: gu,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        const galaxy = new THREE.Points(gg, gm);
        galaxy.frustumCulled = false;
        const galaxyHolder = new THREE.Group();
        galaxyHolder.position.set(-95, 38, -(STEP * 6) - 230);
        galaxyHolder.rotation.set(1.0, 0, 0.45);
        galaxyHolder.add(galaxy);
        scene.add(galaxyHolder);
        const coreGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({
            map: track(glowTexture([[0, "rgba(255,200,140,.9)"], [0.25, "rgba(255,160,90,.35)"], [1, "rgba(255,140,60,0)"]])),
            blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
        })));
        coreGlow.scale.set(210, 210, 1);
        coreGlow.position.copy(galaxyHolder.position);
        scene.add(coreGlow);

        // ---------- Nebula clouds ----------
        const nebTex = [
            track(glowTexture([[0, "rgba(150,90,255,.55)"], [1, "rgba(150,90,255,0)"]])),
            track(glowTexture([[0, "rgba(60,130,255,.5)"], [1, "rgba(60,130,255,0)"]])),
            track(glowTexture([[0, "rgba(255,90,170,.4)"], [1, "rgba(255,90,170,0)"]])),
        ];
        for (let i = 0; i < 9; i++) {
            const s = new THREE.Sprite(track(new THREE.SpriteMaterial({
                map: nebTex[i % 3], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35,
            })));
            const sc = 110 + Math.random() * 120;
            s.scale.set(sc, sc * 0.7, 1);
            s.position.set((i % 2 ? 1 : -1) * (45 + Math.random() * 50), (Math.random() - 0.5) * 60, -i * 48 - 20);
            scene.add(s);
        }

        // ---------- Stations & planets ----------
        const xs = [0, -4, 4, -4, 4, -3, 0];
        const ys = [0, 2, -2, 2, -2, 1, 0];
        const stations = xs.map((x, i) => new THREE.Vector3(x, ys[i], -STEP * i));
        type P = {
            mesh: THREE.Group; mat: THREE.ShaderMaterial; spec: PlanetSpec; sun: THREE.Vector3;
            moon?: THREE.Mesh; ring?: THREE.ShaderMaterial; flare?: { el: LensflareElement; base: THREE.Color }[];
            ready: boolean;
        };
        const planets: P[] = [];
        const sphereGeo = track(new THREE.SphereGeometry(1, mobile ? 64 : 96, mobile ? 48 : 64));
        const atmoGeo = track(new THREE.SphereGeometry(1, 48, 48));
        const ringGeo = track(new THREE.RingGeometry(1.4, 2.5, 160, 1));
        const loader = new THREE.TextureLoader();
        const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const timers: number[] = [];
        const loadTex = (name: string, done: (t: THREE.Texture) => void, ext = "webp") => {
            const t = loader.load(`/tex/${name}.${ext}`, () => done(t));
            t.wrapS = THREE.RepeatWrapping;
            t.anisotropy = aniso;
            track(t);
            return t;
        };
        const mats = (spec: PlanetSpec): THREE.ShaderMaterial => {
            const base = {
                uHas: { value: 0 }, uRot: { value: 0 }, uTime: { value: 0 }, uMap: { value: null as THREE.Texture | null },
                uFallback: { value: new THREE.Color(spec.fallback) }, uAtmo: { value: new THREE.Color(spec.atmo) },
                uSun: { value: new THREE.Vector3(-0.6, 0.35, 0.7) },
            };
            const earth = spec.kind === "earth" ? { uDay: { value: null }, uNight: { value: null }, uSpec: { value: null }, uClouds: { value: null } } : {};
            return track(new THREE.ShaderMaterial({
                vertexShader: PLANET_VERT,
                fragmentShader: spec.kind === "earth" ? EARTH_FRAG : spec.kind === "sun" ? SUN_FRAG : TEX_FRAG,
                uniforms: { ...base, ...earth },
            }));
        };

        PLANETS.forEach((spec, i) => {
            const group = new THREE.Group();
            const mat = mats(spec);
            const body = new THREE.Mesh(sphereGeo, mat);
            if (spec.tilt) body.rotation.z = spec.tilt * 0.3;
            group.add(body);
            const sun = new THREE.Vector3(...(spec.sun ?? [-0.6, 0.35, 0.7])).normalize();
            const entry: P = { mesh: group, mat, spec, sun, ready: false };

            const atmoMat = track(new THREE.ShaderMaterial({
                vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
                uniforms: {
                    uColor: { value: new THREE.Color(spec.atmo) }, uSun: { value: sun }, uPow: { value: spec.atmoPow },
                    uK: { value: Math.sqrt(1 - 1 / (spec.atmoScale * spec.atmoScale)) }, uTwi: { value: spec.kind === "sun" ? 0 : 1 },
                },
                side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
            }));
            const atmo = new THREE.Mesh(atmoGeo, atmoMat);
            atmo.scale.setScalar(spec.atmoScale);
            group.add(atmo);

            if (spec.ring) {
                const rm = track(new THREE.ShaderMaterial({
                    vertexShader: RING_VERT, fragmentShader: RING_FRAG,
                    uniforms: {
                        uRing: { value: null as THREE.Texture | null }, uHas: { value: 0 }, uIn: { value: 1.4 }, uOut: { value: 2.5 },
                        uPR: { value: 1 }, uCenter: { value: new THREE.Vector3() }, uSun: { value: sun },
                    },
                    side: THREE.DoubleSide, transparent: true, depthWrite: false,
                }));
                const ring = new THREE.Mesh(ringGeo, rm);
                ring.rotation.x = Math.PI / 2 - (spec.tilt ?? 0.4);
                ring.rotation.y = -0.2;
                group.add(ring);
                entry.ring = rm;
            }

            if (spec.moon) {
                const mm = mats({ ...spec, kind: "tex", fallback: "#8d8d8d", atmo: "#9aa0b0" });
                (mm.uniforms.uSun.value as THREE.Vector3).copy(sun);
                const moon = new THREE.Mesh(sphereGeo, mm);
                moon.scale.setScalar(0.27);
                group.add(moon);
                entry.moon = moon;
                (moon.userData as { mat: THREE.ShaderMaterial }).mat = mm;
            }

            if (spec.kind === "sun") {
                const f0 = loader.load("/tex/lensflare0.png");
                const f3 = loader.load("/tex/lensflare3.png");
                track(f0); track(f3);
                const lf = new Lensflare();
                const defs: [THREE.Texture, number, number, THREE.Color][] = [
                    [f0, 640, 0, new THREE.Color(1, 0.72, 0.45)],
                    [f3, 60, 0.6, new THREE.Color(1, 0.8, 0.6)],
                    [f3, 110, 0.72, new THREE.Color(0.6, 0.8, 1)],
                    [f3, 70, 0.9, new THREE.Color(1, 0.6, 0.8)],
                    [f3, 150, 1.0, new THREE.Color(1, 0.85, 0.6)],
                ];
                entry.flare = defs.map(([t, sz, dist, c]) => {
                    const el = new LensflareElement(t, sz, dist, c.clone());
                    lf.addElement(el);
                    return { el, base: c };
                });
                group.add(lf);
            }
            scene.add(group);
            planets.push(entry);
        });

        const uni1 = (m: THREE.ShaderMaterial, k: string, v: unknown) => { (m.uniforms[k] as { value: unknown }).value = v; };
        const loadPlanet = (i: number) => {
            const p = planets[i];
            const { spec, mat } = p;
            if (spec.kind === "earth") {
                let n = 0;
                const ok = () => { if (++n === 4) { uni1(mat, "uHas", 1); p.ready = true; } };
                (["earth_day:uDay", "earth_night:uNight", "earth_spec:uSpec", "earth_clouds:uClouds"]).forEach((x) => {
                    const [f, u] = x.split(":");
                    loadTex(f, (t) => { uni1(mat, u, t); ok(); });
                });
                const mm = (p.moon!.userData as { mat: THREE.ShaderMaterial }).mat;
                loadTex("moon", (t) => { uni1(mm, "uMap", t); uni1(mm, "uHas", 1); });
            } else {
                loadTex(spec.tex!, (t) => { uni1(mat, "uMap", t); uni1(mat, "uHas", 1); p.ready = true; });
            }
            if (p.ring) loadTex("saturn_ring", (t) => { uni1(p.ring!, "uRing", t); uni1(p.ring!, "uHas", 1); });
        };
        loadPlanet(0);
        for (let i = 1; i < planets.length; i++) timers.push(window.setTimeout(() => loadPlanet(i), 900 + i * 700));

        // ---------- Bloom (HDR, half-res) on capable devices ----------
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        let composer: EffectComposer | null = null;
        let bloom: UnrealBloomPass | null = null;
        if (!mobile && !lowEnd && !reduce) {
            composer = new EffectComposer(renderer);
            composer.addPass(new RenderPass(scene, camera));
            bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.8, 0.6, 0.95);
            composer.addPass(bloom);
        }

        // ---------- Layout / resize ----------
        let W = 1, H = 1, aspect = 1;
        const layout = () => {
            W = window.innerWidth; H = window.innerHeight; aspect = W / H;
            renderer.setSize(W, H, false);
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
            const hh = Math.tan((camera.fov * Math.PI) / 360);
            const d = 32;
            const hw = hh * aspect * d;
            const radius = aspect < 0.9 ? 4.6 : 7;
            planets.forEach((p, i) => {
                const side = i % 2 === 0 ? 1 : -1;
                const s = stations[i];
                const x = aspect < 0.9 ? side * hw * 0.55 : side * Math.min(hw * 0.64, 30);
                const y = aspect < 0.9 ? (side > 0 ? 7 : -7) : -1.5 + (i % 3) * 1.2;
                p.mesh.position.set(s.x + x, s.y + y, s.z - d);
                p.mesh.userData.base = radius * p.spec.size;
                p.mesh.scale.setScalar(p.mesh.userData.base);
                if (!p.spec.sun) p.sun.set(-side * 0.7, 0.32, 0.65).normalize();
                uni1(p.mat, "uSun", p.sun);
                if (p.moon) uni1((p.moon.userData as { mat: THREE.ShaderMaterial }).mat, "uSun", p.sun);
            });
            composer?.setSize(W, H);
            const px = renderer.domElement.height;
            const scale = px / (2 * hh);
            uni.uScale.value = scale; gu.uScale.value = scale;
            uni.uMaxPx.value = 3.6 * dpr; gu.uMaxPx.value = 6 * dpr;
        };

        // ---------- Scroll -> station coordinate ----------
        let anchors: number[] = [];
        const measure = () => {
            anchors = STATION_IDS.map((id, i) => {
                const e = document.getElementById(id);
                return i === 0 ? 0 : e ? e.getBoundingClientRect().top + window.scrollY : NaN;
            });
            for (let i = 1; i < anchors.length; i++) if (!(anchors[i] > anchors[i - 1])) anchors[i] = anchors[i - 1] + 1;
        };
        const stationFloat = () => {
            const vh = window.innerHeight;
            const probe = window.scrollY + vh * 0.35;
            let u = 0;
            for (let i = 0; i < anchors.length - 1; i++) {
                const A = anchors[i + 1];
                const Z = Math.min(vh * 0.6, (A - anchors[i]) * 0.45);
                u += smooth(0, 1, (probe - (A - Z)) / (Z * 1.1));
            }
            return u;
        };

        measure();
        layout();
        const ro = new ResizeObserver(() => { measure(); });
        ro.observe(document.body);
        const onResize = () => { layout(); measure(); };
        window.addEventListener("resize", onResize);

        // ---------- Loop ----------
        const look = new THREE.Vector3(), lookA = new THREE.Vector3(), lookB = new THREE.Vector3();
        let cur = 0, prevZ = 0, speed = 0, last = performance.now(), raf = 0, ema = 16, slow = 0, t = 0;
        const px = new THREE.Vector3();

        const place = (u: number, dt: number) => {
            const i = Math.min(stations.length - 2, Math.max(0, Math.floor(u)));
            const f = u - i;
            const e = smooth(0.22, 0.78, f);
            const a = stations[i], b = stations[i + 1];
            px.set(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, a.z + (b.z - a.z) * e);
            camera.position.copy(px);
            lookA.set(a.x, a.y, a.z - 60); lookB.set(b.x, b.y, b.z - 60);
            look.lerpVectors(lookA, lookB, e);
            camera.lookAt(look);
            const dz = px.z - prevZ;
            prevZ = px.z;
            const inst = dt > 0 ? dz / dt : 0; // negative when moving forward
            speed += (inst - speed) * (1 - Math.exp(-dt * 10));
        };

        const frame = (now: number) => {
            raf = requestAnimationFrame(frame);
            if (document.hidden) { last = now; return; }
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            t += dt;

            // adaptive resolution
            ema += (dt * 1000 - ema) * 0.05;
            if (ema > 26 && dpr > 0.75) { if (++slow > 80) { dpr = Math.max(0.75, dpr - 0.25); renderer.setPixelRatio(dpr); composer?.setPixelRatio(dpr); layout(); slow = 0; ema = 16; } }
            else slow = 0;

            const target = stationFloat();
            cur += (target - cur) * (1 - Math.exp(-dt * 3.4));
            place(cur, dt);

            const warp = Math.max(-1, Math.min(1, -speed / 160));
            const aw = Math.abs(warp);
            uni.uCamZ.value = camera.position.z;
            uni.uCamXY.value.set(camera.position.x, camera.position.y, 0);
            uni.uWarp.value = warp * 34;
            uni.uDim.value = 1 - smooth(0.05, 0.5, aw) * 0.85;
            uni.uLine.value = smooth(0.02, 0.35, aw) * 0.95;
            camera.fov = 55 + aw * 16;
            camera.updateProjectionMatrix();

            galaxy.rotation.y += dt * 0.012;
            planets.forEach((p) => {
                const dist = camera.position.distanceTo(p.mesh.position);
                const k = 1 - smooth(55, 105, dist);
                p.mesh.visible = k > 0.01;
                if (!p.mesh.visible) return;
                p.mesh.scale.setScalar((p.mesh.userData.base as number) * (0.25 + 0.75 * k));
                uni1(p.mat, "uRot", t * p.spec.spin);
                uni1(p.mat, "uTime", t);
                if (p.ring) {
                    uni1(p.ring, "uCenter", p.mesh.position);
                    uni1(p.ring, "uPR", p.mesh.scale.x);
                }
                if (p.moon) {
                    const a = t * 0.18 + 1.2;
                    p.moon.position.set(Math.cos(a) * 2.7, Math.sin(a * 0.7) * 0.4, Math.sin(a) * 2.7);
                    const mm = (p.moon.userData as { mat: THREE.ShaderMaterial }).mat;
                    uni1(mm, "uRot", t * 0.01);
                }
                if (p.flare) {
                    const f = 1 - smooth(40, 125, dist);
                    p.flare.forEach(({ el, base }) => el.color.copy(base).multiplyScalar(f));
                }
            });
            if (bloom) bloom.strength = 0.55 + aw * 0.3;
            if (composer) composer.render(); else renderer.render(scene, camera);
        };

        if (reduce) {
            cur = stationFloat();
            place(cur, 0);
            uni.uCamZ.value = camera.position.z;
            renderer.render(scene, camera);
            const onScrollStatic = () => { cur = stationFloat(); place(cur, 0); uni.uCamZ.value = camera.position.z; renderer.render(scene, camera); };
            window.addEventListener("scroll", onScrollStatic, { passive: true });
            return () => {
                window.removeEventListener("scroll", onScrollStatic);
                window.removeEventListener("resize", onResize);
                ro.disconnect();
                disposables.forEach((d) => d.dispose());
                renderer.dispose();
                renderer.domElement.remove();
            };
        }

        cur = stationFloat();
        prevZ = stations[0].z;
        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            timers.forEach((id) => clearTimeout(id));
            window.removeEventListener("resize", onResize);
            ro.disconnect();
            composer?.dispose();
            disposables.forEach((d) => d.dispose());
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
        };
    }, [onFail]);

    return <div ref={host} aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-black-100" />;
}
