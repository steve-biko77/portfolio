"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

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
    kind: 0 | 1 | 2; // 0 rocky, 1 gas bands, 2 star
    a: string; b: string; c: string; atmo: string;
    ring?: boolean; seed: number;
};

const PLANETS: PlanetSpec[] = [
    { kind: 1, a: "#241556", b: "#7b4fd6", c: "#f0d4ff", atmo: "#a77bff", ring: true, seed: 1.3 },
    { kind: 0, a: "#052b43", b: "#1f8fb8", c: "#e2f8ff", atmo: "#5cc8ff", seed: 4.1 },
    { kind: 0, a: "#431808", b: "#c2622b", c: "#ffe0b0", atmo: "#ff9a55", seed: 7.7 },
    { kind: 1, a: "#430d38", b: "#c13a8f", c: "#ffd0ec", atmo: "#ff6cc4", seed: 2.2 },
    { kind: 0, a: "#082a1f", b: "#2f8f5b", c: "#e2ffee", atmo: "#5dffa6", seed: 9.4 },
    { kind: 1, a: "#0c1b55", b: "#3a62e0", c: "#d6e6ff", atmo: "#6f95ff", ring: true, seed: 5.6 },
    { kind: 2, a: "#ff5a10", b: "#ffb347", c: "#fff2c0", atmo: "#ff9340", seed: 3.3 },
];

const PLANET_VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vWN; varying vec3 vWP;
void main(){
  vObj = normalize(position);
  vWN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position,1.);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const PLANET_FRAG = /* glsl */ `
precision highp float;
varying vec3 vObj; varying vec3 vWN; varying vec3 vWP;
uniform vec3 uA, uB, uC, uAtmo, uSun; uniform float uKind, uSeed, uTime;
${NOISE}
void main(){
  vec3 p = vObj * 2.4 + uSeed;
  vec3 col;
  float emis = 0.;
  if(uKind < .5){
    float h = fbm(p * 1.6);
    float cont = smoothstep(.46,.56,h);
    col = mix(uA, uB, cont);
    col = mix(col, uC, smoothstep(.62,.8,h) + smoothstep(.82,.98,abs(vObj.y)) * .9);
    col *= .85 + .3 * fbm(p * 7.);
  } else if(uKind < 1.5){
    float t = vObj.y * 9. + fbm(vec3(vObj.x * 2., vObj.y * 11., vObj.z * 2.) + uSeed + uTime * .03) * 2.4;
    float b = .5 + .5 * sin(t);
    col = mix(uA, uB, b);
    col = mix(col, uC, smoothstep(.65,1., .5 + .5 * sin(t * 1.9 + 1.7)) * .55);
    col *= .9 + .2 * fbm(p * 5.);
  } else {
    float f = fbm(p * 2. + vec3(0., uTime * .08, 0.));
    float g = fbm(p * 6. - uTime * .05);
    col = mix(uA, uB, f);
    col = mix(col, uC, smoothstep(.5,.9, g * f * 2.));
    emis = 1.;
  }
  vec3 n = normalize(vWN);
  vec3 v = normalize(cameraPosition - vWP);
  float d = dot(n, normalize(uSun));
  float lit = smoothstep(-.08, .75, d);
  float rim = pow(1. - max(dot(n, v), 0.), 3.);
  vec3 outc = col * (.05 + lit * 1.15);
  outc += uAtmo * rim * (.15 + lit * .9) * (1. - emis * .5);
  outc = mix(outc, col * 1.5 + uC * rim * .6, emis);
  gl_FragColor = vec4(outc, 1.);
}`;

const ATMO_VERT = /* glsl */ `
varying vec3 vN;
void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
const ATMO_FRAG = /* glsl */ `
varying vec3 vN; uniform vec3 uColor; uniform float uPow;
void main(){ float i = pow(max(.72 - dot(vN, vec3(0.,0.,1.)), 0.), uPow); gl_FragColor = vec4(uColor * i * 1.6, i); }`;

const RING_VERT = /* glsl */ `
varying float vR; varying vec3 vWP;
void main(){ vR = length(position.xy); vec4 wp = modelMatrix * vec4(position,1.); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const RING_FRAG = /* glsl */ `
precision highp float; varying float vR; varying vec3 vWP; uniform vec3 uColor; uniform float uIn, uOut;
${NOISE}
void main(){
  float t = (vR - uIn) / (uOut - uIn);
  float bands = .55 + .45 * sin(t * 70. + noise(vec3(t * 20., 0., 0.)) * 6.);
  float gap = smoothstep(.0,.06,t) * (1. - smoothstep(.94,1.,t)) * (1. - .8 * smoothstep(.52,.54,t) * (1. - smoothstep(.56,.58,t)));
  float a = bands * gap * .75;
  gl_FragColor = vec4(uColor * (.6 + .6 * bands), a);
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
        const planets: { mesh: THREE.Group; body: THREE.Mesh; mat: THREE.ShaderMaterial; spec: PlanetSpec }[] = [];
        const sphereGeo = track(new THREE.IcosahedronGeometry(1, mobile ? 40 : 64));
        const atmoGeo = track(new THREE.SphereGeometry(1, 48, 48));
        const ringGeo = track(new THREE.RingGeometry(1.45, 2.5, 128, 1));

        PLANETS.forEach((spec, i) => {
            const group = new THREE.Group();
            const mat = track(new THREE.ShaderMaterial({
                vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG,
                uniforms: {
                    uA: { value: new THREE.Color(spec.a) }, uB: { value: new THREE.Color(spec.b) }, uC: { value: new THREE.Color(spec.c) },
                    uAtmo: { value: new THREE.Color(spec.atmo) }, uSun: { value: new THREE.Vector3(-0.6, 0.35, 0.7) },
                    uKind: { value: spec.kind }, uSeed: { value: spec.seed }, uTime: { value: 0 },
                },
            }));
            const body = new THREE.Mesh(sphereGeo, mat);
            group.add(body);
            const am = track(new THREE.ShaderMaterial({
                vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
                uniforms: { uColor: { value: new THREE.Color(spec.atmo) }, uPow: { value: spec.kind === 2 ? 2.2 : 3.4 } },
                side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
            }));
            const atmo = new THREE.Mesh(atmoGeo, am);
            atmo.scale.setScalar(spec.kind === 2 ? 1.5 : 1.16);
            group.add(atmo);
            if (spec.ring) {
                const rm = track(new THREE.ShaderMaterial({
                    vertexShader: RING_VERT, fragmentShader: RING_FRAG,
                    uniforms: { uColor: { value: new THREE.Color(spec.c) }, uIn: { value: 1.45 }, uOut: { value: 2.5 } },
                    side: THREE.DoubleSide, transparent: true, depthWrite: false,
                }));
                const ring = new THREE.Mesh(ringGeo, rm);
                ring.rotation.x = Math.PI / 2 - 0.35;
                ring.rotation.y = i % 2 ? 0.25 : -0.25;
                group.add(ring);
            }
            if (spec.kind === 2) {
                const glow = new THREE.Sprite(track(new THREE.SpriteMaterial({
                    map: track(glowTexture([[0, "rgba(255,220,160,.8)"], [0.3, "rgba(255,140,60,.3)"], [1, "rgba(255,100,30,0)"]])),
                    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
                })));
                glow.scale.set(7, 7, 1);
                group.add(glow);
            }
            scene.add(group);
            planets.push({ mesh: group, body, mat, spec });
        });

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
                p.mesh.userData.base = p.spec.kind === 2 ? radius * 1.15 : radius;
                p.mesh.scale.setScalar(p.mesh.userData.base);
                (p.mat.uniforms.uSun.value as THREE.Vector3).set(-side * 0.7, 0.32, 0.65).normalize();
            });
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
            if (ema > 26 && dpr > 0.75) { if (++slow > 80) { dpr = Math.max(0.75, dpr - 0.25); renderer.setPixelRatio(dpr); layout(); slow = 0; ema = 16; } }
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
            planets.forEach((p, i) => {
                const k = 1 - smooth(75, 150, camera.position.distanceTo(p.mesh.position));
                p.mesh.visible = k > 0.01;
                if (p.mesh.visible) p.mesh.scale.setScalar((p.mesh.userData.base as number) * (0.25 + 0.75 * k));
                p.body.rotation.y += dt * (0.05 + i * 0.006);
                (p.mat.uniforms.uTime as { value: number }).value = t;
            });
            renderer.render(scene, camera);
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
            window.removeEventListener("resize", onResize);
            ro.disconnect();
            disposables.forEach((d) => d.dispose());
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
        };
    }, [onFail]);

    return <div ref={host} aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-black-100" />;
}
