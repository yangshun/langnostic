import { createGlobeOverlay, type GlobeLayout } from './globe';

const vertexSource = `
  attribute vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const fragmentSource = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_time;
  uniform float u_dark;
  uniform vec3 u_globe;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = mat2(1.6, -1.2, 1.2, 1.6) * p;
      a *= 0.5;
    }
    return v;
  }

  vec3 prism(vec2 uv, float dark) {
    vec3 bg = mix(vec3(0.9765, 0.9686, 0.9490), vec3(0.0706, 0.0627, 0.0941), dark);
    vec2 center = vec2(u_globe.x, 1.0 - u_globe.y);
    float radius = u_globe.z;
    vec2 p = (uv - center) * vec2(u_resolution.x / u_resolution.y, 1.0);
    p -= u_pointer * 0.009;
    float r = length(p) / radius;
    float glow = exp(-r * r * 1.5);
    vec3 halo = mix(vec3(0.83, 0.77, 0.9), vec3(0.31, 0.21, 0.46), dark);
    vec3 color = mix(bg, halo, glow * mix(0.35, 0.55, dark));
    float shadow = exp(-length((p - vec2(0.01, -radius * 1.08)) * vec2(1.0, 8.0)) * 13.0);
    color -= shadow * mix(0.07, 0.018, dark);
    if (r < 1.005) {
      vec2 q = p / radius;
      float z = sqrt(max(0.0, 1.0 - dot(q, q)));
      vec3 normal = vec3(q, z);
      float t = u_time * 0.12;
      float flow = fbm(q * 2.0 + vec2(t, t * -0.5));
      float bands = sin(q.x * 3.0 + q.y * 4.0 + flow * 5.0 + t);
      vec3 lilac = mix(vec3(0.77, 0.67, 0.91), vec3(0.64, 0.42, 0.92), dark);
      vec3 peach = mix(vec3(0.94, 0.71, 0.58), vec3(0.95, 0.61, 0.51), dark);
      vec3 blue = mix(vec3(0.48, 0.69, 0.8), vec3(0.3, 0.64, 0.82), dark);
      vec3 surface = mix(lilac, peach, bands * 0.5 + 0.5);
      surface = mix(surface, blue, smoothstep(0.1, 0.8, q.x - q.y * 0.5 + flow * 0.3));
      float diffuse = max(dot(normal, normalize(vec3(-0.4, 0.6, 1.0))), 0.0);
      surface *= mix(0.63, 0.45, dark) + diffuse * mix(0.4, 0.6, dark);
      float fresnel = pow(1.0 - z, 3.0);
      surface += fresnel * mix(vec3(0.32, 0.32, 0.36), vec3(0.45, 0.35, 0.58), dark);
      float highlight = pow(max(dot(normal, normalize(vec3(-0.5, 0.65, 1.0))), 0.0), 20.0);
      surface += highlight * 0.36;
      float filament = pow(0.5 + 0.5 * sin(q.y * 16.0 + q.x * 8.0 + flow * 7.0 + t), 13.0);
      surface += filament * vec3(0.12, 0.09, 0.12) * (0.3 + fresnel);
      color = mix(color, surface, 1.0 - smoothstep(0.994, 1.005, r));
    }
    return color;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 color = prism(uv, u_dark);
    color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** No rendering framework, capped at 30 fps and 1M pixels per canvas. */
export function createHeroShader(
  canvas: HTMLCanvasElement,
  initialPaused: boolean,
  initialDark: boolean,
) {
  const art = canvas.parentElement;
  const globeFrame = art?.querySelector<HTMLElement>('.hero-globe');
  if (!globeFrame) return null;
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: 'low-power',
  });
  if (!gl) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const release = () => {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
  };
  if (!vertex || !fragment || !program || !buffer) {
    release();
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    release();
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, 'u_resolution');
  const time = gl.getUniformLocation(program, 'u_time');
  const dark = gl.getUniformLocation(program, 'u_dark');
  const pointer = gl.getUniformLocation(program, 'u_pointer');
  const globeUniform = gl.getUniformLocation(program, 'u_globe');
  const globe = createGlobeOverlay(canvas);

  const events = new AbortController();
  let layout: GlobeLayout | undefined;
  let paused = initialPaused;
  let visible = true;
  let lost = false;
  let frame = 0;
  let previousTime = 0;
  let elapsed = 16;
  let currentDark = initialDark;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;

  const draw = () => {
    if (lost || !layout) return;
    pointerX += (targetX - pointerX) * 0.045;
    pointerY += (targetY - pointerY) * 0.045;
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform1f(time, elapsed);
    gl.uniform1f(dark, currentDark ? 1 : 0);
    gl.uniform3f(globeUniform, layout.centerX, layout.centerY, layout.radius);
    gl.uniform2f(pointer, pointerX, pointerY);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    globe?.draw(elapsed, currentDark, layout, pointerX, pointerY);
    globeFrame.style.setProperty(
      '--globe-pointer-x',
      `${pointerX * canvas.clientHeight * 0.009}px`,
    );
    globeFrame.style.setProperty(
      '--globe-pointer-y',
      `${-pointerY * canvas.clientHeight * 0.009}px`,
    );
    art?.setAttribute('data-rendered', '');
  };
  const animate = (now: number) => {
    frame = 0;
    if (paused || !visible || document.hidden || lost) return;
    if (now - previousTime >= 1000 / 30) {
      elapsed += Math.min((now - previousTime) / 1000, 0.05);
      previousTime = now;
      draw();
    }
    frame = requestAnimationFrame(animate);
  };
  const sync = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    const playing = !paused && visible && !document.hidden && !lost;
    art?.toggleAttribute('data-playing', playing);
    if (playing) {
      previousTime = performance.now();
      frame = requestAnimationFrame(animate);
    }
  };
  const resize = () => {
    const { width, height, left, top } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const bounds = globeFrame.getBoundingClientRect();
    layout = {
      centerX: (bounds.left + bounds.width / 2 - left) / width,
      centerY: (bounds.top + bounds.height / 2 - top) / height,
      radius: bounds.width / 2 / height,
    };
    const scale = Math.min(
      devicePixelRatio,
      1.5,
      Math.sqrt(1_000_000 / (width * height)),
    );
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resizeObserver.observe(globeFrame);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  intersectionObserver.observe(canvas);
  document.addEventListener('visibilitychange', sync, {
    signal: events.signal,
  });
  canvas.closest('.home-hero')?.addEventListener(
    'pointermove',
    (event) => {
      if (paused || !(event instanceof PointerEvent)) return;
      const rect = canvas.getBoundingClientRect();
      targetX = (event.clientX - rect.left) / rect.width - 0.5;
      targetY = 0.5 - (event.clientY - rect.top) / rect.height;
    },
    { signal: events.signal, passive: true },
  );
  canvas.addEventListener(
    'webglcontextlost',
    () => {
      lost = true;
      art?.removeAttribute('data-rendered');
      sync();
    },
    { signal: events.signal },
  );
  resize();
  sync();

  return {
    setDark(value: boolean) {
      currentDark = value;
      draw();
    },
    setPaused(value: boolean) {
      paused = value;
      sync();
    },
    dispose() {
      cancelAnimationFrame(frame);
      art?.removeAttribute('data-playing');
      events.abort();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      globe?.dispose();
      release();
    },
  };
}
