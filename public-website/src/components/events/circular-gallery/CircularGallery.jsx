import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl';
import { useEffect, useRef } from 'react';

import './CircularGallery.css';

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function lerp(p1, p2, t) {
  return p1 + (p2 - p1) * t;
}

function autoBind(instance) {
  const proto = Object.getPrototypeOf(instance);
  Object.getOwnPropertyNames(proto).forEach(key => {
    if (key !== 'constructor' && typeof instance[key] === 'function') {
      instance[key] = instance[key].bind(instance);
    }
  });
}

const DEFAULT_FONT = 'bold 30px Figtree';
// Figtree is not guaranteed to be available on the host page, so the component
// loads it on demand whenever the default font is used.
const DEFAULT_FONT_URL = 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;700&display=swap';

function deriveFontFamilyFromUrl(url) {
  const fileName = (url.split('/').pop() || 'custom-font').split('?')[0];
  const base = fileName.replace(/\.(woff2?|ttf|otf|eot)$/i, '');
  return base.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'CircularGalleryFont';
}

async function loadFontFromStylesheet(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch font stylesheet (${response.status})`);
  const cssText = await response.text();
  const faceBlocks = cssText.match(/@font-face\s*{[^}]*}/g) || [];
  let family = null;
  const fontFaces = [];
  for (const block of faceBlocks) {
    const familyMatch = block.match(/font-family:\s*['"]?([^;'"]+)['"]?/);
    const urlMatch = block.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
    if (!familyMatch || !urlMatch) continue;
    family = familyMatch[1].trim();
    const descriptors = {};
    const weightMatch = block.match(/font-weight:\s*([^;]+);/);
    const styleMatch = block.match(/font-style:\s*([^;]+);/);
    const rangeMatch = block.match(/unicode-range:\s*([^;]+);/);
    if (weightMatch) descriptors.weight = weightMatch[1].trim();
    if (styleMatch) descriptors.style = styleMatch[1].trim();
    if (rangeMatch) descriptors.unicodeRange = rangeMatch[1].trim();
    fontFaces.push(new FontFace(family, `url(${urlMatch[1]})`, descriptors));
  }
  if (!family) throw new Error('No @font-face rule found in the stylesheet');
  await Promise.allSettled(
    fontFaces.map(async face => {
      await face.load();
      document.fonts.add(face);
    })
  );
  return family;
}

async function loadFontFromFile(url) {
  const family = deriveFontFamilyFromUrl(url);
  const fontFace = new FontFace(family, `url(${url})`);
  await fontFace.load();
  document.fonts.add(fontFace);
  return family;
}

async function loadCustomFont(fontUrl) {
  const isStylesheet = fontUrl.includes('fonts.googleapis.com') || /\.css(\?.*)?$/i.test(fontUrl);
  return isStylesheet ? loadFontFromStylesheet(fontUrl) : loadFontFromFile(fontUrl);
}

// Loads `fontUrl` (a stylesheet such as a Google Fonts URL, or a direct font
// file) and returns a canvas-ready font string that keeps the size/weight from
// `font` but swaps in the freshly loaded family. Falls back to `font` on error.
async function resolveFont(font, fontUrl) {
  // Use the bundled Figtree stylesheet when the caller relies on the default
  // font, otherwise honor the explicit `fontUrl`.
  const effectiveUrl = fontUrl || (font === DEFAULT_FONT ? DEFAULT_FONT_URL : null);
  if (!effectiveUrl) {
    // A custom family was supplied without a URL – make sure it is ready (in
    // case the host page declares it) before we draw it to the canvas,
    // otherwise the first paint silently falls back to a system font.
    if (document.fonts && document.fonts.load) {
      try {
        await document.fonts.load(font);
        await document.fonts.ready;
      } catch {
        // Ignore – fall back to whatever the browser provides.
      }
    }
    return font;
  }
  try {
    const family = await loadCustomFont(effectiveUrl);
    const sizeMatch = font.match(/^\s*(.*?\d+px)/);
    const prefix = sizeMatch ? sizeMatch[1].trim() : 'bold 30px';
    const resolved = `${prefix} "${family}"`;
    if (document.fonts && document.fonts.load) {
      try {
        await document.fonts.load(resolved);
      } catch {
        // Ignore – we still attempt to render with the requested font.
      }
    }
    return resolved;
  } catch (error) {
    console.error('CircularGallery: unable to load font from', fontUrl, error);
    return font;
  }
}

function getFontSize(font) {
  const match = font.match(/(\d+)px/);
  return match ? parseInt(match[1], 10) : 30;
}

function createTextTexture(gl, text, font = 'bold 30px monospace', color = 'black') {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
  const logicalFontSize = getFontSize(font);
  // Larger base (48–64px) × DPR so canvas text stays sharp when stretched in GL.
  const baseDrawSize = Math.min(Math.max(logicalFontSize, 48), 64);
  const drawFontSize = Math.round(baseDrawSize * dpr);
  const scale = drawFontSize / logicalFontSize;
  const drawFont = font.replace(/(\d+)px/, `${drawFontSize}px`);
  context.font = drawFont;
  const metrics = context.measureText(text);
  const textWidth = Math.ceil(metrics.width);
  const textHeight = Math.ceil(drawFontSize * 1.2);
  const pad = Math.ceil(10 * scale);
  canvas.width = textWidth + pad * 2;
  canvas.height = textHeight + pad * 2;
  context.font = drawFont;
  context.fillStyle = color;
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new Texture(gl, { generateMipmaps: false });
  texture.image = canvas;
  // Logical (CSS) size for mesh scale so on-screen text size stays the same.
  return { texture, width: canvas.width / scale, height: canvas.height / scale };
}

class Title {
  constructor({ gl, plane, renderer, text, textColor = '#545050', font = '30px sans-serif' }) {
    autoBind(this);
    this.gl = gl;
    this.plane = plane;
    this.renderer = renderer;
    this.text = text;
    this.textColor = textColor;
    this.font = font;
    this.createMesh();
  }
  createMesh() {
    const { texture, width, height } = createTextTexture(this.gl, this.text, this.font, this.textColor);
    const geometry = new Plane(this.gl);
    const program = new Program(this.gl, {
      vertex: `
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform sampler2D tMap;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tMap, vUv);
          if (color.a < 0.1) discard;
          gl_FragColor = color;
        }
      `,
      uniforms: { tMap: { value: texture } },
      transparent: true
    });
    this.mesh = new Mesh(this.gl, { geometry, program });
    const aspect = width / height;
    const textHeight = this.plane.scale.y * 0.15;
    const textWidth = textHeight * aspect;
    this.mesh.scale.set(textWidth, textHeight, 1);
    this.mesh.position.y = -this.plane.scale.y * 0.5 - textHeight * 0.5 - 0.05;
    this.mesh.setParent(this.plane);
  }
}

class Media {
  constructor({
    geometry,
    gl,
    image,
    index,
    length,
    renderer,
    scene,
    screen,
    text,
    viewport,
    bend,
    textColor,
    borderRadius = 0,
    font,
    orientation = 'horizontal',
    planeHeightRatio = 0.72
  }) {
    this.extra = 0;
    this.geometry = geometry;
    this.gl = gl;
    this.image = image;
    this.index = index;
    this.length = length;
    this.renderer = renderer;
    this.scene = scene;
    this.screen = screen;
    this.text = text;
    this.viewport = viewport;
    this.bend = bend;
    this.textColor = textColor;
    this.borderRadius = borderRadius;
    this.font = font;
    this.orientation = orientation;
    this.planeHeightRatio = planeHeightRatio;
    this.isVertical = orientation === 'vertical';
    this.createShader();
    this.createMesh();
    this.createTitle();
    this.onResize();
  }
  createShader() {
    const texture = new Texture(this.gl, {
      generateMipmaps: true
    });
    this.program = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      vertex: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z = 0.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform vec2 uImageSizes;
        uniform vec2 uPlaneSizes;
        uniform sampler2D tMap;
        uniform float uBorderRadius;
        varying vec2 vUv;
        
        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b;
          return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
        }
        
        void main() {
          vec2 ratio = vec2(
            min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
            min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
          );
          vec2 uv = vec2(
            vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
            vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
          );
          vec4 color = texture2D(tMap, uv);
          
          float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
          
          // Smooth antialiasing for edges
          float edgeSmooth = 0.002;
          float alpha = 1.0 - smoothstep(-edgeSmooth, edgeSmooth, d);
          
          gl_FragColor = vec4(color.rgb, alpha);
        }
      `,
      uniforms: {
        tMap: { value: texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [0, 0] },
        uBorderRadius: { value: this.borderRadius }
      },
      transparent: true
    });
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = this.image;
    img.onload = () => {
      texture.image = img;
      this.program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight];
    };
  }
  createMesh() {
    this.plane = new Mesh(this.gl, {
      geometry: this.geometry,
      program: this.program
    });
    this.plane.setParent(this.scene);
  }
  createTitle() {
    this.title = new Title({
      gl: this.gl,
      plane: this.plane,
      renderer: this.renderer,
      text: this.text,
      textColor: this.textColor,
      font: this.font
    });
  }
  update(scroll, direction) {
    if (this.isVertical) {
      this.plane.position.y = this.y - scroll.current - this.extra;

      // True half-circle with center on the right canvas edge (bend ignored).
      const y = this.plane.position.y;
      const centerX = this.viewport.width / 2;
      const R = this.viewport.height / 2;
      const yClamped = Math.max(-R, Math.min(R, y));
      this.plane.position.x = centerX - Math.sqrt(R * R - yClamped * yClamped);
      // Negative asin keeps the prior left-curve upright feel
      this.plane.rotation.z = -Math.asin(yClamped / R);
    } else {
      this.plane.position.x = this.x - scroll.current - this.extra;

      const x = this.plane.position.x;
      const H = this.viewport.width / 2;

      if (this.bend === 0) {
        this.plane.position.y = 0;
        this.plane.rotation.z = 0;
      } else {
        const B_abs = Math.abs(this.bend);
        const R = (H * H + B_abs * B_abs) / (2 * B_abs);
        const effectiveX = Math.min(Math.abs(x), H);

        const arc = R - Math.sqrt(R * R - effectiveX * effectiveX);
        if (this.bend > 0) {
          this.plane.position.y = -arc;
          this.plane.rotation.z = -Math.sign(x) * Math.asin(effectiveX / R);
        } else {
          this.plane.position.y = arc;
          this.plane.rotation.z = Math.sign(x) * Math.asin(effectiveX / R);
        }
      }
    }

    if (this.isVertical) {
      const planeOffset = this.plane.scale.y / 2;
      const viewportOffset = this.viewport.height / 2;
      this.isBefore = this.plane.position.y + planeOffset < -viewportOffset;
      this.isAfter = this.plane.position.y - planeOffset > viewportOffset;
      if (direction === 'down' && this.isBefore) {
        this.extra -= this.heightTotal;
        this.isBefore = this.isAfter = false;
      }
      if (direction === 'up' && this.isAfter) {
        this.extra += this.heightTotal;
        this.isBefore = this.isAfter = false;
      }
    } else {
      const planeOffset = this.plane.scale.x / 2;
      const viewportOffset = this.viewport.width / 2;
      this.isBefore = this.plane.position.x + planeOffset < -viewportOffset;
      this.isAfter = this.plane.position.x - planeOffset > viewportOffset;
      if (direction === 'right' && this.isBefore) {
        this.extra -= this.widthTotal;
        this.isBefore = this.isAfter = false;
      }
      if (direction === 'left' && this.isAfter) {
        this.extra += this.widthTotal;
        this.isBefore = this.isAfter = false;
      }
    }
  }
  onResize({ screen, viewport } = {}) {
    if (screen) this.screen = screen;
    if (viewport) {
      this.viewport = viewport;
      if (this.plane.program.uniforms.uViewportSizes) {
        this.plane.program.uniforms.uViewportSizes.value = [this.viewport.width, this.viewport.height];
      }
    }
    if (this.isVertical) {
      // 3 full landscape cards + corner peeks; no width-based height shrink
      const slots = 3.15;
      const h = this.viewport.height / slots;
      const w = h * (16 / 9);
      this.plane.scale.y = h;
      this.plane.scale.x = w;
      this.plane.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y];
      this.padding = h * 0.04;
      this.height = this.plane.scale.y + this.padding;
      this.heightTotal = this.height * this.length;
      this.y = this.height * this.index;
    } else {
      // Landscape 16:9 cards for horizontal galleries (home Highlights, mobile event gallery)
      const h = this.viewport.height * this.planeHeightRatio;
      const w = h * (16 / 9);
      this.plane.scale.y = h;
      this.plane.scale.x = w;
      this.plane.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y];
      this.padding = w * 0.06;
      this.width = w + this.padding;
      this.widthTotal = this.width * this.length;
      this.x = this.width * this.index;
    }
  }
}

class App {
  constructor(
    container,
    {
      items,
      bend,
      textColor = '#ffffff',
      borderRadius = 0,
      font = 'bold 30px Figtree',
      scrollSpeed = 2,
      scrollEase = 0.05,
      orientation = 'horizontal',
      planeHeightRatio = 0.72,
      autoplayIntervalMs,
      continuousScrollSpeed
    } = {}
  ) {
    document.documentElement.classList.remove('no-js');
    this.container = container;
    this.scrollSpeed = scrollSpeed;
    this.orientation = orientation;
    this.planeHeightRatio = planeHeightRatio;
    this.isVertical = orientation === 'vertical';
    this.autoplayIntervalMs = autoplayIntervalMs;
    this.continuousScrollSpeed = continuousScrollSpeed || 0;
    this.lastTs = performance.now();
    this.autoplayTimer = null;
    this.scroll = { ease: scrollEase, current: 0, target: 0, last: 0 };
    this.onCheckDebounce = debounce(this.onCheck, 200);
    this.createRenderer();
    this.createCamera();
    this.createScene();
    this.onResize();
    this.createGeometry();
    this.createMedias(items, bend, textColor, borderRadius, font);
    this.update();
    this.addEventListeners();
    this.startAutoplay();
  }
  createRenderer() {
    this.renderer = new Renderer({
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2)
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.container.appendChild(this.gl.canvas);
  }
  createCamera() {
    this.camera = new Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;
  }
  createScene() {
    this.scene = new Transform();
  }
  createGeometry() {
    this.planeGeometry = new Plane(this.gl, {
      heightSegments: 50,
      widthSegments: 100
    });
  }
  createMedias(items, bend = 1, textColor, borderRadius, font) {
    const defaultItems = [
      { image: `https://picsum.photos/seed/1/800/600?grayscale`, text: 'Bridge' },
      { image: `https://picsum.photos/seed/2/800/600?grayscale`, text: 'Desk Setup' },
      { image: `https://picsum.photos/seed/3/800/600?grayscale`, text: 'Waterfall' },
      { image: `https://picsum.photos/seed/4/800/600?grayscale`, text: 'Strawberries' },
      { image: `https://picsum.photos/seed/5/800/600?grayscale`, text: 'Deep Diving' },
      { image: `https://picsum.photos/seed/16/800/600?grayscale`, text: 'Train Track' },
      { image: `https://picsum.photos/seed/17/800/600?grayscale`, text: 'Santorini' },
      { image: `https://picsum.photos/seed/8/800/600?grayscale`, text: 'Blurry Lights' },
      { image: `https://picsum.photos/seed/9/800/600?grayscale`, text: 'New York' },
      { image: `https://picsum.photos/seed/10/800/600?grayscale`, text: 'Good Boy' },
      { image: `https://picsum.photos/seed/21/800/600?grayscale`, text: 'Coastline' },
      { image: `https://picsum.photos/seed/12/800/600?grayscale`, text: 'Palm Trees' }
    ];
    const galleryItems = items && items.length ? items : defaultItems;
    this.mediasImages = galleryItems.concat(galleryItems);
    this.medias = this.mediasImages.map((data, index) => {
      return new Media({
        geometry: this.planeGeometry,
        gl: this.gl,
        image: data.image,
        index,
        length: this.mediasImages.length,
        renderer: this.renderer,
        scene: this.scene,
        screen: this.screen,
        text: data.text,
        viewport: this.viewport,
        bend,
        textColor,
        borderRadius,
        font,
        orientation: this.orientation,
        planeHeightRatio: this.planeHeightRatio
      });
    });
  }
  onTouchDown(e) {
    // Block page scroll while interacting with the gallery (touch only).
    if (e.touches && e.cancelable) e.preventDefault();
    this.isDown = true;
    this.resetAutoplay();
    this.scroll.position = this.scroll.current;
    if (this.isVertical) {
      this.start = e.touches ? e.touches[0].clientY : e.clientY;
    } else {
      this.start = e.touches ? e.touches[0].clientX : e.clientX;
    }
  }
  onTouchMove(e) {
    if (!this.isDown) return;
    // Keep page from scrolling/dragging while scrubbing the gallery.
    if (e.cancelable) e.preventDefault();
    const pos = this.isVertical
      ? e.touches
        ? e.touches[0].clientY
        : e.clientY
      : e.touches
        ? e.touches[0].clientX
        : e.clientX;
    // Vertical: invert so drag-down moves images down (scroll decreases).
    const delta = this.isVertical ? pos - this.start : this.start - pos;
    const distance = delta * (this.scrollSpeed * 0.025);
    this.scroll.target = this.scroll.position + distance;
  }
  onTouchUp() {
    this.isDown = false;
    this.onCheck();
    this.resetAutoplay();
  }
  onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY || e.wheelDelta || e.detail;
    // Vertical: invert so wheel-down decreases scroll → images move down.
    const step = (delta > 0 ? this.scrollSpeed : -this.scrollSpeed) * 0.2;
    this.scroll.target += this.isVertical ? -step : step;
    this.onCheckDebounce();
    this.resetAutoplay();
  }
  onKeyDown(e) {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        this.scroll.target += this.scrollSpeed * 5;
        this.onCheckDebounce();
        this.resetAutoplay();
        break;

      case 'ArrowDown':
        e.preventDefault();
        // Vertical: ArrowDown decreases scroll so content moves down with the key.
        this.scroll.target += (this.isVertical ? -1 : 1) * this.scrollSpeed * 5;
        this.onCheckDebounce();
        this.resetAutoplay();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        this.scroll.target -= this.scrollSpeed * 5;
        this.onCheckDebounce();
        this.resetAutoplay();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.scroll.target += (this.isVertical ? 1 : -1) * this.scrollSpeed * 5;
        this.onCheckDebounce();
        this.resetAutoplay();
        break;

      case 'Home':
        e.preventDefault();
        this.scroll.target = 0;
        this.onCheckDebounce();
        this.resetAutoplay();
        break;

      default:
        break;
    }
  }

  startAutoplay() {
    this.stopAutoplay();
    if (!this.autoplayIntervalMs || this.autoplayIntervalMs <= 0) return;
    this.autoplayTimer = window.setInterval(() => this.onAutoplayTick(), this.autoplayIntervalMs);
  }

  stopAutoplay() {
    if (this.autoplayTimer != null) {
      window.clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  resetAutoplay() {
    this.startAutoplay();
  }

  onAutoplayTick() {
    if (this.isDown) return;
    if (!this.medias || !this.medias[0]) return;
    const size = this.isVertical ? this.medias[0].height : this.medias[0].width;
    if (!size) return;
    // Advance one card; vertical uses the opposite direction from wheel-down.
    this.scroll.target += size;
    this.onCheck();
  }

  onCheck() {
    // Continuous marquee mode must not snap to card centers.
    if (this.continuousScrollSpeed) return;
    if (!this.medias || !this.medias[0]) return;
    const size = this.isVertical ? this.medias[0].height : this.medias[0].width;
    const itemIndex = Math.round(Math.abs(this.scroll.target) / size);
    const item = size * itemIndex;
    this.scroll.target = this.scroll.target < 0 ? -item : item;
  }
  onResize() {
    this.screen = {
      width: this.container.clientWidth,
      height: this.container.clientHeight
    };
    this.renderer.setSize(this.screen.width, this.screen.height);
    this.camera.perspective({
      aspect: this.screen.width / this.screen.height
    });
    const fov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;
    this.viewport = { width, height };
    if (this.medias) {
      this.medias.forEach(media => media.onResize({ screen: this.screen, viewport: this.viewport }));
    }
  }
  update() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTs) / 1000);
    this.lastTs = now;
    if (this.continuousScrollSpeed && !this.isDown) {
      this.scroll.target += this.continuousScrollSpeed * dt;
    }
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease);
    const direction = this.isVertical
      ? this.scroll.current > this.scroll.last
        ? 'down'
        : 'up'
      : this.scroll.current > this.scroll.last
        ? 'right'
        : 'left';
    if (this.medias) {
      this.medias.forEach(media => media.update(this.scroll, direction));
    }
    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.scroll.last = this.scroll.current;
    this.raf = window.requestAnimationFrame(this.update.bind(this));
  }
  addEventListeners() {
    this.boundOnResize = this.onResize.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnTouchDown = this.onTouchDown.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchUp = this.onTouchUp.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);

    // Keep resize on window; scope wheel/drag to the gallery container so
    // scrolling the details column does not spin the gallery.
    window.addEventListener('resize', this.boundOnResize);

    if (this.container) {
      // passive: false so preventDefault can block page scroll while scrubbing.
      this.container.addEventListener('mousewheel', this.boundOnWheel, { passive: false });
      this.container.addEventListener('wheel', this.boundOnWheel, { passive: false });
      this.container.addEventListener('mousedown', this.boundOnTouchDown);
      this.container.addEventListener('mousemove', this.boundOnTouchMove);
      this.container.addEventListener('mouseup', this.boundOnTouchUp);
      this.container.addEventListener('mouseleave', this.boundOnTouchUp);
      // passive: false so preventDefault can block page scroll on touch scrub.
      this.container.addEventListener('touchstart', this.boundOnTouchDown, { passive: false });
      this.container.addEventListener('touchmove', this.boundOnTouchMove, { passive: false });
      this.container.addEventListener('touchend', this.boundOnTouchUp);
      this.container.addEventListener('keydown', this.boundOnKeyDown);
    }
  }
  destroy() {
    this.stopAutoplay();
    window.cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.boundOnResize);
    if (this.container) {
      this.container.removeEventListener('mousewheel', this.boundOnWheel);
      this.container.removeEventListener('wheel', this.boundOnWheel);
      this.container.removeEventListener('mousedown', this.boundOnTouchDown);
      this.container.removeEventListener('mousemove', this.boundOnTouchMove);
      this.container.removeEventListener('mouseup', this.boundOnTouchUp);
      this.container.removeEventListener('mouseleave', this.boundOnTouchUp);
      this.container.removeEventListener('touchstart', this.boundOnTouchDown);
      this.container.removeEventListener('touchmove', this.boundOnTouchMove);
      this.container.removeEventListener('touchend', this.boundOnTouchUp);
      this.container.removeEventListener('keydown', this.boundOnKeyDown);
    }
    if (this.renderer && this.renderer.gl && this.renderer.gl.canvas.parentNode) {
      this.renderer.gl.canvas.parentNode.removeChild(this.renderer.gl.canvas);
    }
  }
}

export default function CircularGallery({
  items,
  bend = 3,
  textColor = '#ffffff',
  borderRadius = 0.05,
  font = 'bold 30px Figtree',
  fontUrl,
  scrollSpeed = 2,
  scrollEase = 0.05,
  orientation = 'horizontal',
  planeHeightRatio = 0.72,
  autoplayIntervalMs,
  continuousScrollSpeed
}) {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
    let app;
    let isMounted = true;
    resolveFont(font, fontUrl).then(resolvedFont => {
      if (!isMounted || !containerRef.current) return;
      app = new App(containerRef.current, {
        items,
        bend,
        textColor,
        borderRadius,
        font: resolvedFont,
        scrollSpeed,
        scrollEase,
        orientation,
        planeHeightRatio,
        autoplayIntervalMs,
        continuousScrollSpeed
      });
    });

    return () => {
      isMounted = false;
      if (app) app.destroy();
    };
  }, [
    items,
    bend,
    textColor,
    borderRadius,
    font,
    fontUrl,
    scrollSpeed,
    scrollEase,
    orientation,
    planeHeightRatio,
    autoplayIntervalMs,
    continuousScrollSpeed
  ]);
  const ariaLabel =
    orientation === 'vertical'
      ? 'Circular image gallery. Use up and down arrow keys to navigate.'
      : 'Circular image gallery. Use left and right arrow keys to navigate.';
  return (
    <div
      className="circular-gallery"
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label={ariaLabel}
    />
  );
}
