// mapa3d.js — motor Three.js del mapa Pronóstico.
// Regiones extruidas con un shader propio: color plano según el valor, con luz suave (mapa del tiempo).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Equirectangular con corrección de coseno; 1 unidad = 1° de latitud (~111 km).
const LAT0 = -36, LON0 = -71;
const KX = Math.cos(THREE.MathUtils.degToRad(LAT0));
export const proyectar = (lon, lat) => new THREE.Vector2((lon - LON0) * KX, lat - LAT0);
const ALTURA_MIN = 0.05;

const VERT = /* glsl */`
  varying vec3 vW; varying vec3 vN;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FRAG = /* glsl */`
  uniform vec3 uColor; uniform vec3 uLuz;
  uniform float uValor; uniform float uResalte;
  varying vec3 vW; varying vec3 vN;
  void main() {
    vec3 n = normalize(vN);
    float L = clamp(dot(n, normalize(uLuz)) * 0.5 + 0.5, 0.0, 1.0);
    bool tapa = n.y > 0.5;
    vec3 col = tapa ? uColor * (0.96 + 0.04 * L) : uColor * (0.52 + 0.38 * L);
    col = mix(col, vec3(1.0), uResalte * 0.22);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {HTMLElement} o.capaEtiquetas
 * @param {object} o.geo
 * @param {object} o.tema  { fondo, suelo, sueloVisible, reticula{visible,color,opacidad,etiquetas}, borde{color,opacidad}, orientacion, inclinacion }
 */
export function crearMapa({ canvas, capaEtiquetas, geo, tema, alSeleccionar, alHover, alCuadro }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const etiquetas = new CSS2DRenderer({ element: capaEtiquetas });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.5, 500);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(78);
  controls.minDistance = 5;
  controls.maxDistance = 160;
  controls.screenSpacePanning = true;

  const pivote = new THREE.Group();
  scene.add(pivote);

  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: tema.suelo ?? 0xffffff }));
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.y = -0.01;
  suelo.visible = tema.sueloVisible ?? false;
  scene.add(suelo);

  // Retícula de latitudes (y meridianos) opcional
  const ret = tema.reticula ?? {};
  if (ret.visible) {
    const mat = new THREE.LineBasicMaterial({ color: ret.color ?? 0x888888, transparent: true, opacity: ret.opacidad ?? 0.3 });
    const g = new THREE.Group();
    for (let lat = -20; lat >= -55; lat -= 5) {
      const a = proyectar(-78, lat), b = proyectar(-64, lat);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, 0, -a.y), new THREE.Vector3(b.x, 0, -b.y)]), mat));
      if (ret.etiquetas) {
        const d = document.createElement('div'); d.className = 'etq-lat'; d.textContent = `${-lat}°`;
        const o = new CSS2DObject(d); o.position.set(a.x, 0, -a.y); g.add(o);
      }
    }
    if (ret.meridianos) for (let lon = -76; lon <= -64; lon += 4) {
      const a = proyectar(lon, -17), b = proyectar(lon, -56.5);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, 0, -a.y), new THREE.Vector3(b.x, 0, -b.y)]), mat));
    }
    pivote.add(g);
  }

  const luz = new THREE.Vector3(-0.5, 0.9, 0.7);
  const regiones = new Map();
  const bordeMat = new THREE.LineBasicMaterial({ color: tema.borde?.color ?? 0x000000, transparent: true, opacity: tema.borde?.opacidad ?? 0.6 });
  for (const r of geo.regiones) {
    const formas = r.poligonos.map(([ext, ...huecos]) => {
      const s = new THREE.Shape(ext.map(([lon, lat]) => proyectar(lon, lat)));
      s.holes = huecos.map((h) => new THREE.Path(h.map(([lon, lat]) => proyectar(lon, lat))));
      return s;
    });
    const geom = new THREE.ExtrudeGeometry(formas, { depth: 1, bevelEnabled: false, curveSegments: 1 });
    geom.rotateX(-Math.PI / 2);
    geom.computeBoundingBox();
    const uniforms = {
      uColor: { value: new THREE.Color(0x999999) },
      uLuz: { value: luz },
      uValor: { value: 0 },
      uResalte: { value: 0 }
    };
    const malla = new THREE.Mesh(geom, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms }));
    malla.scale.y = ALTURA_MIN;
    malla.userData.codigo = r.codigo;
    const borde = new THREE.Group();
    for (const [ext, ...huecos] of r.poligonos) for (const anillo of [ext, ...huecos]) {
      const pts = anillo.map(([lon, lat]) => { const q = proyectar(lon, lat); return new THREE.Vector3(q.x, 1.002, -q.y); });
      borde.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), bordeMat));
    }
    malla.add(borde);
    pivote.add(malla);
    const caja = geom.boundingBox.clone();
    regiones.set(r.codigo, {
      ...r, malla, uniforms, caja, centro: caja.getCenter(new THREE.Vector3()),
      altura: ALTURA_MIN, desde: ALTURA_MIN, objetivo: ALTURA_MIN,
      valor: 0, valorDesde: 0, valorObj: 0,
      color: new THREE.Color(0x999999), colorDesde: new THREE.Color(), colorObj: new THREE.Color(0x999999)
    });
  }

  // ---- Orientación, márgenes y encuadre ----
  let orientacion = tema.orientacion === 'auto' || !tema.orientacion ? (innerWidth < innerHeight ? 'vertical' : 'horizontal') : tema.orientacion;
  const aplicarOrientacion = () => { pivote.rotation.y = orientacion === 'horizontal' ? Math.PI / 2 : 0; pivote.updateMatrixWorld(true); };
  aplicarOrientacion();
  let margen = { izq: 0, der: 0, arr: 0, aba: 0 };
  const tam = () => ({ W: renderer.domElement.clientWidth || 1, H: renderer.domElement.clientHeight || 1 });
  function aplicarMargen() {
    const { W, H } = tam();
    const dx = (margen.izq - margen.der) / 2, dy = (margen.arr - margen.aba) / 2;
    if (dx || dy) camera.setViewOffset(W, H, -dx, -dy, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  const aMundo = (v) => v.clone().applyMatrix4(pivote.matrixWorld);
  const inclinacion = tema.inclinacion ?? { horizontal: [0.74, 0.67], vertical: [0.9, 0.44] };
  function vistaPara(nombre) {
    const tramos = { general: [-36.5, 1], norte: [-22.5, 0.36], centro: [-35, 0.3], sur: [-48.5, 0.42] };
    const [lat, f] = tramos[nombre] ?? tramos.general;
    const p = proyectar(-71, lat);
    const obj = aMundo(new THREE.Vector3(p.x, 0, -p.y));
    const { W, H } = tam();
    const libreW = Math.max(120, W - margen.izq - margen.der), libreH = Math.max(120, H - margen.arr - margen.aba);
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const largo = 39.5 * f;
    const [y, z] = inclinacion[orientacion];
    // En vertical el largo se acorta en pantalla por la inclinación (factor y).
    const dist = orientacion === 'horizontal'
      ? (largo / 2) / (t * (libreW / H)) * 1.02
      : (largo * y / 2) / (t * (libreH / H)) * 1.06;
    const dir = new THREE.Vector3(0, y, z).normalize();
    if (nombre === 'general' || !tramos[nombre]) {
      // Búsqueda binaria de la distancia mínima a la que el país entero cabe en el área libre.
      const fx = libreW / W * 0.94, fy = libreH / H * 0.94;
      const pts = [];
      for (const r of regiones.values()) for (const px of [r.caja.min.x, r.caja.max.x]) for (const pz of [r.caja.min.z, r.caja.max.z])
        for (const py of [0, escala * 0.55]) pts.push(new THREE.Vector3(px, py, pz).applyMatrix4(pivote.matrixWorld));
      const cam = camera.clone(); cam.copy(camera);
      const cabe = (d) => {
        cam.position.copy(obj).addScaledVector(dir, d); cam.lookAt(obj); cam.updateMatrixWorld(true);
        return pts.every((q) => { const n = q.clone().project(cam); return Math.abs(n.x) <= fx && Math.abs(n.y) <= fy; });
      };
      let lo = 5, hi = 400;
      for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (cabe(m)) hi = m; else lo = m; }
      return { obj, pos: obj.clone().addScaledVector(dir, hi) };
    }
    return { obj, pos: obj.clone().addScaledVector(dir, Math.max(dist, 7)) };
  }
  let vuelo = null;
  const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function volarA(obj, pos, ms = 1100) {
    vuelo = { t0: performance.now(), ms: reducido() ? 0 : ms, de: { o: controls.target.clone(), p: camera.position.clone() }, a: { o: obj, p: pos } };
    invalidar();
  }
  function vista(nombre, ms) { const v = vistaPara(nombre); volarA(v.obj, v.pos, ms); }
  function enfocarRegion(cod) {
    const r = regiones.get(cod); if (!r) return;
    const c = aMundo(r.centro.clone().setY(0));
    const s = r.caja.getSize(new THREE.Vector3());
    const ext = Math.max(s.x, s.z, 3);
    const dir = camera.position.clone().sub(controls.target).normalize();
    volarA(c, c.clone().addScaledVector(dir, ext * 4 + 18));
  }

  // ---- Estado visual ----
  let escala = tema.escalaAltura ?? 4.5;
  let anim = null, hoverCod = null, selCod = null;
  function actualizar(datos, { ms = 650 } = {}) {
    for (const [cod, r] of regiones) {
      const d = datos.get(cod);
      r.desde = r.altura; r.valorDesde = r.valor; r.colorDesde.copy(r.color);
      r.sinDato = !d || d.t == null;
      r.objetivo = r.sinDato ? ALTURA_MIN : Math.max(ALTURA_MIN, d.t * escala);
      r.valorObj = r.sinDato ? 0 : d.t;
      r.colorObj.set(r.sinDato ? (tema.sinDato ?? '#9a9a9a') : d.color ?? '#999999');
    }
    anim = { t0: performance.now(), ms: reducido() ? 0 : ms };
    invalidar();
  }
  function pintar(r) {
    r.malla.scale.y = r.altura;
    const u = r.uniforms;
    u.uValor.value = r.valor;
    u.uColor.value.copy(r.color);
    u.uResalte.value = r.codigo === selCod ? 1 : r.codigo === hoverCod ? 0.55 : 0;
  }

  // ---- Puntero ----
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const mallas = [...regiones.values()].map((r) => r.malla);
  let pick = null, abajo = null;
  const aNDC = (e) => { const b = canvas.getBoundingClientRect(); ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); };
  const elegir = () => { ray.setFromCamera(ptr, camera); return ray.intersectObjects(mallas, false)[0]?.object.userData.codigo ?? null; };
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; aNDC(e); pick = { x: e.clientX, y: e.clientY }; invalidar(); });
  canvas.addEventListener('pointerleave', () => { pick = null; setHover(null); });
  canvas.addEventListener('pointerdown', (e) => { abajo = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!abajo || Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 6) return;
    aNDC(e); alSeleccionar?.(elegir());
  });
  function setHover(cod, pos) {
    if (cod !== hoverCod) { hoverCod = cod; canvas.style.cursor = cod ? 'pointer' : ''; invalidar(); }
    alHover?.(cod, pos);
  }

  // ---- Bucle bajo demanda ----
  let pendiente = null;
  function invalidar() { if (pendiente === null) pendiente = requestAnimationFrame(cuadro); }
  controls.addEventListener('change', invalidar);
  const suave = (x) => 1 - Math.pow(1 - x, 3);
  const v3 = new THREE.Vector3();
  function cuadro(ahora) {
    pendiente = null;
    let seguir = false;
    if (vuelo) {
      const k = vuelo.ms ? Math.min(1, (ahora - vuelo.t0) / vuelo.ms) : 1, s = suave(k);
      controls.target.lerpVectors(vuelo.de.o, vuelo.a.o, s);
      camera.position.lerpVectors(vuelo.de.p, vuelo.a.p, s);
      if (k >= 1) vuelo = null; else seguir = true;
    }
    if (anim) {
      const k = anim.ms ? Math.min(1, (ahora - anim.t0) / anim.ms) : 1, s = suave(k);
      for (const r of regiones.values()) {
        r.altura = THREE.MathUtils.lerp(r.desde, r.objetivo, s);
        r.valor = THREE.MathUtils.lerp(r.valorDesde, r.valorObj, s);
        r.color.copy(r.colorDesde).lerp(r.colorObj, s);
      }
      if (k >= 1) anim = null; else seguir = true;
    }
    if (controls.update()) seguir = true;
    if (pick) { const p = pick; pick = null; setHover(elegir(), p); }
    for (const r of regiones.values()) pintar(r);
    renderer.render(scene, camera);
    etiquetas.render(scene, camera);
    alCuadro?.();
    window.__sceneReady = true;
    if (seguir) invalidar();
  }

  function redimensionar() {
    const { width, height } = canvas.parentElement.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    etiquetas.setSize(width, height);
    camera.aspect = width / height;
    aplicarMargen();
    invalidar();
  }
  new ResizeObserver(redimensionar).observe(canvas.parentElement);
  redimensionar();

  /** Posición en pantalla (px, relativa al lienzo) del centro superior de una región. */
  function enPantalla(cod) {
    const r = regiones.get(cod); if (!r) return null;
    v3.set(r.centro.x, r.altura, r.centro.z).applyMatrix4(pivote.matrixWorld).project(camera);
    const { W, H } = tam();
    return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H, visible: v3.z < 1 };
  }

  window.__viewer = { views: ['general', 'norte', 'centro', 'sur'], setView: (n) => (vista(n, 0), true) };

  return {
    actualizar, vista, enfocarRegion, enPantalla, invalidar,
    setMargen(m) { margen = m; aplicarMargen(); invalidar(); },
    setOrientacion(o) { orientacion = o; aplicarOrientacion(); vista('general'); },
    get orientacion() { return orientacion; },
    setSeleccion(cod) { selCod = cod; invalidar(); },
    get hover() { return hoverCod; }
  };
}
