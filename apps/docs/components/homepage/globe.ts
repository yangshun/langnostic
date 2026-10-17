import earth from './geography/earth.json';

export type GlobeLayout = {
  centerX: number;
  centerY: number;
  radius: number;
};

const radians = Math.PI / 180;
const tilt = 0.2;
const tiltCos = Math.cos(tilt);
const tiltSin = Math.sin(tilt);

function sphere(longitude: number, latitude: number) {
  const longitudeRadians = longitude * radians;
  const latitudeRadians = latitude * radians;
  return [
    Math.cos(latitudeRadians) * Math.sin(longitudeRadians),
    Math.sin(latitudeRadians),
    Math.cos(latitudeRadians) * Math.cos(longitudeRadians),
  ];
}

function geometry(coordinates: number[][]) {
  const vertices = new Float32Array(
    coordinates.flatMap(([longitude, latitude]) => sphere(longitude, latitude)),
  );
  return { vertices, projected: new Float32Array(vertices.length) };
}

const coastlines = earth.coastlines.map(geometry);
const land = geometry(earth.landPoints);

// Illustrative connections between language communities, staggered in time.
const connections = [
  [
    [-74.01, 40.71],
    [-0.12, 51.51],
  ],
  [
    [2.35, 48.86],
    [72.88, 19.08],
  ],
  [
    [-9.14, 38.72],
    [18.42, -33.92],
  ],
  [
    [-0.12, 51.51],
    [103.82, 1.35],
  ],
  [
    [-46.63, -23.55],
    [2.35, 48.86],
  ],
  [
    [103.82, 1.35],
    [139.69, 35.68],
  ],
];

const routeSegments = 80;
const routes = connections.map(([from, to]) => {
  const start = sphere(from[0], from[1]);
  const end = sphere(to[0], to[1]);
  const angle = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        start.reduce((sum, value, i) => sum + value * end[i], 0),
      ),
    ),
  );
  const vertices = new Float32Array((routeSegments + 1) * 3);
  for (let i = 0; i <= routeSegments; i++) {
    const progress = i / routeSegments;
    const a = Math.sin((1 - progress) * angle) / Math.sin(angle);
    const b = Math.sin(progress * angle) / Math.sin(angle);
    const elevation = 1 + Math.sin(progress * Math.PI) * 0.2;
    for (let axis = 0; axis < 3; axis++) {
      vertices[i * 3 + axis] = (start[axis] * a + end[axis] * b) * elevation;
    }
  }
  return { vertices, projected: new Float32Array(vertices.length) };
});

function project(
  shape: ReturnType<typeof geometry>,
  rotationCos: number,
  rotationSin: number,
) {
  const { vertices, projected } = shape;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    const z = vertices[i + 2];
    const rotatedZ = x * rotationSin + z * rotationCos;
    projected[i] = x * rotationCos - z * rotationSin;
    projected[i + 1] = y * tiltCos - rotatedZ * tiltSin;
    projected[i + 2] = y * tiltSin + rotatedZ * tiltCos;
  }
}

function inFront(x: number, y: number, z: number, elevated = false) {
  return z > 0.015 || (elevated && x * x + y * y > 1.002);
}

function path(
  context: CanvasRenderingContext2D,
  vertices: Float32Array,
  start = 0,
  end = vertices.length / 3 - 1,
  elevated = false,
) {
  let drawing = false;
  for (let point = start; point <= end; point++) {
    const index = point * 3;
    const x = vertices[index];
    const y = vertices[index + 1];
    if (!inFront(x, y, vertices[index + 2], elevated)) {
      drawing = false;
      continue;
    }
    if (drawing) context.lineTo(x, y);
    else context.moveTo(x, y);
    drawing = true;
  }
  return drawing;
}

/** Shares the shader's size, projection, clock, and pause lifecycle. */
export function createGlobeOverlay(canvas: HTMLCanvasElement) {
  const overlay = document.createElement('canvas');
  const context = overlay.getContext('2d');
  if (!context) return null;
  overlay.className = 'hero-globe-canvas';
  overlay.setAttribute('aria-hidden', 'true');
  canvas.insertAdjacentElement('afterend', overlay);

  return {
    draw(
      elapsed: number,
      dark: boolean,
      layout: GlobeLayout,
      pointerX: number,
      pointerY: number,
    ) {
      if (overlay.width !== canvas.width || overlay.height !== canvas.height) {
        overlay.width = canvas.width;
        overlay.height = canvas.height;
      }
      const { width, height } = overlay;
      const scale = width / canvas.clientWidth;
      const radius = height * layout.radius;
      const centerX = width * layout.centerX + pointerX * height * 0.009;
      const centerY = height * layout.centerY - pointerY * height * 0.009;
      const rotation = elapsed * 0.085 - 0.9;
      const rotationCos = Math.cos(rotation);
      const rotationSin = Math.sin(rotation);
      context.clearRect(0, 0, width, height);
      context.save();
      context.translate(centerX, centerY);
      context.scale(radius, -radius);
      context.lineCap = 'round';
      context.lineJoin = 'round';

      context.save();
      context.beginPath();
      context.arc(0, 0, 0.997, 0, Math.PI * 2);
      context.clip();
      context.beginPath();
      for (const coastline of coastlines) {
        project(coastline, rotationCos, rotationSin);
        path(context, coastline.projected);
      }
      context.strokeStyle = dark ? '#f1e3ff' : '#76518e';
      context.globalAlpha = dark ? 0.62 : 0.54;
      context.lineWidth = (scale * 0.85) / radius;
      context.shadowColor = dark ? '#d6b5ff' : '#b29bd1';
      context.shadowBlur = scale * 3;
      context.stroke();

      project(land, rotationCos, rotationSin);
      context.shadowBlur = 0;
      context.globalAlpha = dark ? 0.34 : 0.25;
      context.fillStyle = dark ? '#f2e4ff' : '#715087';
      context.beginPath();
      const pointSize = (scale * 0.65) / radius;
      for (let i = 0; i < land.projected.length; i += 3) {
        if (land.projected[i + 2] < 0.06) continue;
        const x = land.projected[i];
        const y = land.projected[i + 1];
        context.moveTo(x + pointSize, y);
        context.arc(x, y, pointSize, 0, Math.PI * 2);
      }
      context.fill();
      context.restore();

      routes.forEach((route, index) => {
        const age = (elapsed + index * 2.8) % (routes.length * 2.8);
        const duration = 4;
        if (age > duration) return;
        const fade = Math.min(1, age / 0.4, (duration - age) / 0.7);
        const progress = Math.min(1, age / 3);
        const head = progress * routeSegments;
        const headIndex = Math.min(routeSegments - 1, Math.floor(head));
        const fraction = head - headIndex;
        project(route, rotationCos, rotationSin);
        const positions = route.projected;
        const x =
          positions[headIndex * 3] * (1 - fraction) +
          positions[(headIndex + 1) * 3] * fraction;
        const y =
          positions[headIndex * 3 + 1] * (1 - fraction) +
          positions[(headIndex + 1) * 3 + 1] * fraction;
        const z =
          positions[headIndex * 3 + 2] * (1 - fraction) +
          positions[(headIndex + 1) * 3 + 2] * fraction;

        context.globalAlpha = fade * (dark ? 0.28 : 0.32);
        context.strokeStyle = dark ? '#e8d4ff' : '#7951a8';
        context.shadowBlur = 0;
        context.lineWidth = (scale * 0.85) / radius;
        context.beginPath();
        path(context, positions, 0, routeSegments, true);
        context.stroke();

        const tail = Math.max(0, Math.floor(head - routeSegments * 0.24));
        const gradient = context.createLinearGradient(
          positions[tail * 3],
          positions[tail * 3 + 1],
          x,
          y,
        );
        gradient.addColorStop(0, dark ? '#d1b1ff00' : '#8256bb00');
        gradient.addColorStop(1, dark ? '#fff7ff' : '#8050ba');
        context.globalAlpha = fade;
        context.strokeStyle = gradient;
        context.shadowColor = dark ? '#cca4ff' : '#9a71ca';
        context.shadowBlur = scale * 7;
        context.lineWidth = (scale * 1.7) / radius;
        context.beginPath();
        const reachesHead = path(context, positions, tail, headIndex, true);
        if (inFront(x, y, z, true)) {
          if (reachesHead) context.lineTo(x, y);
          else context.moveTo(x, y);
        }
        context.stroke();

        context.fillStyle = dark ? '#fff9ff' : '#8050ba';
        for (const endpoint of [0, routeSegments]) {
          const offset = endpoint * 3;
          if (positions[offset + 2] <= 0.02) continue;
          context.beginPath();
          context.arc(
            positions[offset],
            positions[offset + 1],
            (scale * 1.5) / radius,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
        if (inFront(x, y, z, true)) {
          context.beginPath();
          context.arc(x, y, (scale * 2) / radius, 0, Math.PI * 2);
          context.fill();
        }
      });
      context.restore();
    },
    dispose() {
      overlay.remove();
    },
  };
}
