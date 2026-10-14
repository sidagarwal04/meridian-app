import type { ThemeId } from "./types";

const VERTEX_SHADER = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

varying vec2 v_uv;

uniform vec2 u_res;
uniform vec2 u_center;
uniform float u_scale;
uniform vec3 u_rot;       // [rLonRad, rLatRad, rGammaRad]
uniform int u_theme;      // 0=earth, 1=cyber, 2=eco, 3=night, 4=paper
uniform int u_projMode;   // 0=orthographic 3D globe, 1=naturalEarth1 2D map
uniform float u_time;
uniform float u_hasTex;
uniform sampler2D u_sdfTex;

const float PI = 3.141592653589793;

// High-quality 3D hash & gradient-like value noise on unit sphere (seam-free at antimeridian!)
float hash3(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(
      mix(hash3(i + vec3(0, 0, 0)), hash3(i + vec3(1, 0, 0)), f.x),
      mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x),
      f.y
    ),
    mix(
      mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
      mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x),
      f.y
    ),
    f.z
  );
}

// Multi-octave FBM on 3D unit sphere
float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  mat3 m = mat3(
    0.00,  0.80,  0.60,
   -0.80,  0.36, -0.48,
   -0.60, -0.48,  0.64
  );
  for (int i = 0; i < 5; i++) {
    v += a * noise3(p);
    p = m * p * 2.07;
    a *= 0.5;
  }
  return v;
}

// Ridged multifractal noise for sharp alpine mountain ranges (Himalayas, Alps, Norway, Andes)
float ridged3(vec3 p) {
  float v = 0.0;
  float a = 0.55;
  float weight = 1.0;
  mat3 m = mat3(
    0.00,  0.80,  0.60,
   -0.80,  0.36, -0.48,
   -0.60, -0.48,  0.64
  );
  for (int i = 0; i < 5; i++) {
    float n = 1.0 - abs(noise3(p) * 2.0 - 1.0);
    n = n * n * weight;
    weight = clamp(n * 1.8, 0.0, 1.0);
    v += n * a;
    p = m * p * 2.18;
    a *= 0.48;
  }
  return v;
}

vec3 sampleGeoData(float lon, float lat) {
  float u = fract((lon + PI) / (2.0 * PI));
  float v = clamp((PI * 0.5 - lat) / PI, 0.001, 0.999);
  return texture2D(u_sdfTex, vec2(u, v)).rgb;
}

// Combined terrain elevation at 3D sphere point P and (lon, lat)
float getTerrainHeight(vec3 P, float lon, float lat, float macroElev, float inland) {
  float r1 = ridged3(P * 14.0);
  float r2 = ridged3(P * 38.0);
  float f1 = fbm3(P * 22.0);
  float mountainMask = pow(clamp(macroElev * 1.25, 0.0, 1.0), 0.78);
  float foothill = inland * (0.14 * f1 + 0.10 * r1);
  return foothill + mountainMask * (0.58 * r1 + 0.34 * r2 + 0.18 * f1);
}

void main() {
  // Screen pixel coordinates with (0,0) at top-left to match 2D Canvas
  vec2 fragPx = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);

  float lon = 0.0;
  float lat = 0.0;
  vec3 P = vec3(0.0);
  vec3 viewNormal = vec3(0.0, 0.0, 1.0);
  float globeR = 0.0;

  if (u_projMode == 0) {
    vec2 rel = (fragPx - u_center) / u_scale;
    rel.y = -rel.y; // +Y up
    globeR = length(rel);

    // Outside sphere: render outer Rayleigh atmospheric corona glow
    if (globeR > 1.0) {
      if (u_theme == 4) {
        gl_FragColor = vec4(0.0);
        return;
      }
      float halo = clamp(1.0 - (globeR - 1.0) / 0.13, 0.0, 1.0);
      float haloPow = pow(halo, 2.8);
      vec3 atmoCol = u_theme == 1
        ? mix(vec3(0.08, 0.90, 1.00), vec3(0.95, 0.16, 0.85), clamp(rel.x * 0.5 + 0.5, 0.0, 1.0))
        : u_theme == 2
        ? vec3(0.20, 0.85, 0.68)
        : u_theme == 3
        ? vec3(0.28, 0.52, 0.98)
        : vec3(0.32, 0.68, 1.00);
      // Directional sun bias on upper-left horizon (matching reference video)
      float sunSide = 0.65 + 0.35 * clamp((-rel.x * 0.45 + rel.y * 0.88), -0.6, 1.0);
      gl_FragColor = vec4(atmoCol * sunSide, haloPow * 0.56);
      return;
    }

    float nz = sqrt(max(0.0, 1.0 - dot(rel, rel)));
    viewNormal = vec3(rel.x, rel.y, nz);

    // Invert d3.geoOrthographic().rotate([rLon, rLat, rGamma])
    float x2 = nz;
    float y2 = rel.x;
    float z2 = rel.y;

    float cg = cos(u_rot.z), sg = sin(u_rot.z);
    float x1 = x2;
    float y1 = y2 * cg + z2 * sg;
    float z1 = z2 * cg - y2 * sg;

    float cp = cos(u_rot.y), sp = sin(u_rot.y);
    float x0 = x1 * cp + z1 * sp;
    float y0 = y1;
    float z0 = z1 * cp - x1 * sp;

    float rawLon = atan(y0, x0) - u_rot.x;
    lon = mod(rawLon + 3.0 * PI, 2.0 * PI) - PI;
    lat = asin(clamp(z0, -1.0, 1.0));
    P = vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
  } else {
    // Invert d3.geoNaturalEarth1() for 2D Map Editor mode
    vec2 rel = (fragPx - u_center) / u_scale;
    float x = rel.x;
    float y = -rel.y;
    // Newton-Raphson inversion for Natural Earth 1
    float phi = y;
    for (int i = 0; i < 7; i++) {
      float phi2 = phi * phi;
      float phi4 = phi2 * phi2;
      float fy = phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4))) - y;
      float dfy = 1.007226 + phi2 * (0.045255 + phi4 * (-0.311325 + 0.259866 * phi2 - 0.065076 * phi4));
      phi -= fy / dfy;
    }
    if (abs(phi) > PI * 0.5) {
      gl_FragColor = vec4(0.0);
      return;
    }
    float phi2 = phi * phi;
    float phi4 = phi2 * phi2;
    float denom = 0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4));
    float lam = x / denom;
    if (abs(lam) > PI) {
      gl_FragColor = vec4(0.0);
      return;
    }
    lon = lam;
    lat = phi;
    P = vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
    viewNormal = vec3(0.0, 0.0, 1.0);
  }

  vec3 geo = u_hasTex > 0.5 ? sampleGeoData(lon, lat) : vec3(0.3, 0.1, 0.5);
  float sdf = geo.r;        // 0.502 (~128/255) = coastline; >0.502 land, <0.502 ocean
  float macroElev = geo.g;  // Mountain ranges & plateaus on land, shelf on ocean
  float vegIndex = geo.b;   // 0 = desert, 0.5 = temperate, 1.0 = lush forest

  // Slight coastline micro-detail so zoomed-in bays & fjords look razor-crisp
  float coastMicro = (fbm3(P * 65.0) - 0.5) * 0.014;
  float signedCoast = (sdf - 0.50196) + coastMicro;
  float landMask = smoothstep(-0.004, 0.005, signedCoast);

  // Directional orbital sun light vector
  vec3 sunDir = normalize(vec3(-0.38, 0.46, 0.80));
  float sphereDiffuse = clamp(dot(viewNormal, sunDir), 0.12, 1.0);

  // ========================
  // 1. OCEAN & COASTAL SHELF
  // ========================
  float oceanDepth = clamp(-signedCoast * 5.2, 0.0, 1.0);
  float shelfFactor = exp(-oceanDepth * 3.2); // Bright turquoise shallow continental shelf
  float midShelf = exp(-oceanDepth * 1.15);

  // Anisotropic coastal water ripples & wave shimmer (matches frame 10-15 around Denmark/Europe!)
  vec3 waveCoord = vec3(lon * 95.0, lat * 135.0, u_time * 0.04);
  float ripple1 = noise3(waveCoord);
  float ripple2 = noise3(waveCoord * 2.35 + vec3(4.2, -3.1, 1.7));
  float wavePattern = (ripple1 * 0.6 + ripple2 * 0.4);
  float coastalShimmer = pow(clamp(wavePattern, 0.0, 1.0), 2.2) * (0.25 + 0.75 * midShelf);

  // Bathymetric ocean floor ridges in deep water
  float bathyRidge = ridged3(P * 9.5) * 0.12 * (1.0 - shelfFactor);

  vec3 deepOceanCol = vec3(0.024, 0.078, 0.185);
  vec3 midOceanCol  = vec3(0.048, 0.155, 0.325);
  vec3 shelfCol     = vec3(0.095, 0.365, 0.560);
  vec3 shimmerCol   = vec3(0.240, 0.590, 0.780);

  if (u_theme == 1) { // Cyber (abyssal obsidian ocean with neon cyan shelf)
    deepOceanCol = vec3(0.012, 0.020, 0.068);
    midOceanCol  = vec3(0.022, 0.052, 0.145);
    shelfCol     = vec3(0.045, 0.240, 0.420);
    shimmerCol   = vec3(0.080, 0.880, 1.000);
  } else if (u_theme == 2) { // Eco (emerald/aquamarine ocean)
    deepOceanCol = vec3(0.025, 0.145, 0.175);
    midOceanCol  = vec3(0.045, 0.245, 0.275);
    shelfCol     = vec3(0.090, 0.440, 0.450);
    shimmerCol   = vec3(0.250, 0.720, 0.680);
  } else if (u_theme == 3) { // Night (deep midnight sapphire)
    deepOceanCol = vec3(0.012, 0.030, 0.078);
    midOceanCol  = vec3(0.024, 0.062, 0.145);
    shelfCol     = vec3(0.048, 0.125, 0.255);
    shimmerCol   = vec3(0.110, 0.240, 0.440);
  } else if (u_theme == 4) { // Paper (vintage cartographic blue with contour rings)
    deepOceanCol = vec3(0.665, 0.795, 0.880);
    midOceanCol  = vec3(0.725, 0.840, 0.915);
    shelfCol     = vec3(0.815, 0.900, 0.950);
    shimmerCol   = vec3(0.580, 0.730, 0.830);
  }

  vec3 oceanColor = mix(deepOceanCol, midOceanCol, midShelf);
  oceanColor = mix(oceanColor, shelfCol, shelfFactor * 0.78);
  oceanColor += shimmerCol * coastalShimmer * (u_theme == 4 ? -0.12 : 0.24);
  oceanColor += vec3(0.06, 0.14, 0.22) * bathyRidge;

  // Specular sun reflection on ocean surface
  vec3 halfVec = normalize(sunDir + vec3(0.0, 0.0, 1.0));
  float spec = pow(clamp(dot(viewNormal, halfVec), 0.0, 1.0), 22.0);
  if (u_theme != 4) {
    oceanColor *= (0.58 + 0.48 * sphereDiffuse);
    oceanColor += vec3(0.18, 0.34, 0.52) * spec * (0.45 + 0.55 * wavePattern);
  } else {
    // Vintage coastal contour lines for Paper theme
    float contour = smoothstep(0.02, 0.0, abs(fract(oceanDepth * 6.0) - 0.5));
    oceanColor = mix(oceanColor, vec3(0.52, 0.68, 0.79), contour * shelfFactor * 0.35);
  }

  // ==============================================
  // 2. LAND SATELLITE BIOMES & 3D MOUNTAIN RELIEF
  // ==============================================
  float inland = clamp(signedCoast * 4.5, 0.0, 1.0);
  float hCenter = getTerrainHeight(P, lon, lat, macroElev, inland);

  // Compute 3D topographic bump gradients for crisp directional hillshading
  float eps = 0.0022;
  vec3 tangentLon = normalize(vec3(-sin(lon), cos(lon), 0.0));
  vec3 tangentLat = normalize(vec3(-sin(lat) * cos(lon), -sin(lat) * sin(lon), cos(lat)));
  float hLon = getTerrainHeight(normalize(P + tangentLon * eps), lon + eps, lat, macroElev, inland);
  float hLat = getTerrainHeight(normalize(P + tangentLat * eps), lon, lat + eps, macroElev, inland);

  float dLon = (hLon - hCenter) / eps;
  float dLat = (hLat - hCenter) / eps;
  float hillshade = clamp(0.68 + (-dLon * 0.011 + dLat * 0.012), 0.28, 1.42);

  // Fine satellite patchwork & forest canopy variation
  float detailA = fbm3(P * 32.0);
  float detailB = fbm3(P * 85.0);
  float ridgeDetail = ridged3(P * 42.0);

  float absLat = abs(lat) / (PI * 0.5);
  float moisture = clamp(vegIndex + (detailA - 0.5) * 0.24, 0.0, 1.0);

  // Satellite biome palette (Earth & Satellite default)
  vec3 lushForest   = vec3(0.115, 0.275, 0.135);
  vec3 tempForest   = vec3(0.185, 0.355, 0.175);
  vec3 farmland     = vec3(0.285, 0.435, 0.225);
  vec3 drySteppe    = vec3(0.495, 0.455, 0.295);
  vec3 desertSand   = vec3(0.735, 0.585, 0.395);
  vec3 desertRock   = vec3(0.585, 0.435, 0.295);
  vec3 alpineRock   = vec3(0.410, 0.395, 0.380);
  vec3 snowPeak     = vec3(0.945, 0.968, 0.992);

  if (u_theme == 1) { // Cyber (dark holographic synth-slate & neon relief)
    lushForest = vec3(0.045, 0.085, 0.195);
    tempForest = vec3(0.058, 0.110, 0.235);
    farmland   = vec3(0.072, 0.138, 0.275);
    drySteppe  = vec3(0.095, 0.115, 0.255);
    desertSand = vec3(0.130, 0.105, 0.275);
    desertRock = vec3(0.105, 0.085, 0.225);
    alpineRock = vec3(0.140, 0.240, 0.420);
    snowPeak   = vec3(0.280, 0.920, 1.000);
  } else if (u_theme == 2) { // Eco
    lushForest = vec3(0.065, 0.295, 0.185);
    tempForest = vec3(0.115, 0.395, 0.245);
    farmland   = vec3(0.185, 0.485, 0.295);
    drySteppe  = vec3(0.295, 0.475, 0.305);
    desertSand = vec3(0.465, 0.545, 0.355);
    desertRock = vec3(0.355, 0.445, 0.295);
    alpineRock = vec3(0.320, 0.420, 0.370);
  } else if (u_theme == 3) { // Night
    lushForest = vec3(0.055, 0.082, 0.135);
    tempForest = vec3(0.072, 0.105, 0.168);
    farmland   = vec3(0.090, 0.128, 0.198);
    drySteppe  = vec3(0.115, 0.145, 0.215);
    desertSand = vec3(0.135, 0.162, 0.235);
    desertRock = vec3(0.105, 0.132, 0.198);
    alpineRock = vec3(0.165, 0.205, 0.285);
    snowPeak   = vec3(0.380, 0.465, 0.610);
  } else if (u_theme == 4) { // Paper
    lushForest = vec3(0.915, 0.895, 0.835);
    tempForest = vec3(0.945, 0.925, 0.875);
    farmland   = vec3(0.965, 0.948, 0.905);
    drySteppe  = vec3(0.935, 0.885, 0.795);
    desertSand = vec3(0.915, 0.845, 0.735);
    desertRock = vec3(0.865, 0.785, 0.675);
    alpineRock = vec3(0.795, 0.735, 0.645);
    snowPeak   = vec3(0.990, 0.985, 0.970);
  }

  // Blend desert -> steppe -> farmland -> temperate forest -> lush forest
  vec3 desertMix = mix(desertRock, desertSand, smoothstep(0.25, 0.75, detailB));
  vec3 greenMix  = mix(tempForest, farmland, smoothstep(0.42, 0.72, detailB));
  greenMix       = mix(greenMix, lushForest, smoothstep(0.68, 0.95, moisture));

  vec3 landColor = mix(desertMix, drySteppe, smoothstep(0.14, 0.36, moisture));
  landColor      = mix(landColor, greenMix, smoothstep(0.32, 0.62, moisture));

  // Add subtle river/valley & agricultural micro-contrast
  landColor *= (0.88 + 0.24 * detailB);

  // Mountain rock & snow-capped ridges (Norway, Alps, Himalayas, Andes, Rockies, Greenland)
  float rockFactor = smoothstep(0.22, 0.52, hCenter + ridgeDetail * 0.14);
  landColor = mix(landColor, alpineRock, rockFactor * 0.82);

  // Snowline lowers at high latitudes (e.g. Scandinavia / Norway at 60N+ and polar regions)
  float latSnowBias = smoothstep(0.58, 0.82, absLat) * 0.36;
  float snowHeight = hCenter + ridgeDetail * 0.18 + latSnowBias;
  float snowMask = smoothstep(0.46, 0.68, snowHeight);
  landColor = mix(landColor, snowPeak, snowMask);

  // Apply 3D topographic relief hillshading & spherical sunlight
  if (u_theme != 4) {
    landColor *= hillshade * (0.56 + 0.52 * sphereDiffuse);
  } else {
    landColor *= (0.78 + 0.32 * hillshade);
  }

  // Night theme: glowing golden-amber city light clusters along coasts & populated hubs
  if (u_theme == 3) {
    float coastalPop = exp(-inland * 3.5);
    float latPop = exp(-pow((absLat - 0.34) / 0.28, 2.0));
    float cityNoise = pow(clamp(fbm3(P * 75.0) * 1.25, 0.0, 1.0), 3.2);
    float cityGlow = cityNoise * (0.35 + 0.65 * coastalPop) * latPop * smoothstep(0.18, 0.48, moisture);
    landColor += vec3(1.00, 0.74, 0.32) * cityGlow * 1.45;
  }

  // Cyber theme: holographic grid, neon cyan coastline rim, topographic contours & magenta/cyan synth nodes
  if (u_theme == 1) {
    float gridLon = smoothstep(0.955, 0.995, cos(lon * 24.0));
    float gridLat = smoothstep(0.955, 0.995, cos(lat * 24.0));
    float holoGrid = max(gridLon, gridLat);
    oceanColor += vec3(0.04, 0.55, 0.78) * holoGrid * 0.22;
    landColor += vec3(0.08, 0.78, 0.96) * holoGrid * 0.18;

    // Glowing topographic elevation contour rings on land
    float topoContour = smoothstep(0.06, 0.0, abs(fract(hCenter * 9.0) - 0.5));
    landColor += vec3(0.10, 0.88, 1.00) * topoContour * (0.18 + 0.35 * clamp(hCenter, 0.0, 1.0));

    // Synthwave magenta & electric cyan urban hub clusters
    float coastalPop = exp(-inland * 3.5);
    float latPop = exp(-pow((absLat - 0.34) / 0.28, 2.0));
    float hubNoise = pow(clamp(fbm3(P * 75.0) * 1.25, 0.0, 1.0), 3.1);
    float hubGlow = hubNoise * (0.35 + 0.65 * coastalPop) * latPop * smoothstep(0.16, 0.48, moisture);
    vec3 neonHubCol = mix(vec3(1.00, 0.16, 0.82), vec3(0.12, 0.94, 1.00), step(0.5, detailB));
    landColor += neonHubCol * hubGlow * 1.55;
  }

  // Crisp coastal beach/littoral transition between shallow shelf and land
  vec3 finalColor = mix(oceanColor, landColor, landMask);

  // Cyber neon cyan shoreline laser edge
  if (u_theme == 1) {
    float coastEdge = exp(-abs(signedCoast) * 155.0);
    finalColor += vec3(0.12, 0.94, 1.00) * coastEdge * 0.78;
  }

  // ========================================================
  // 3. 3D HORIZON ATMOSPHERIC HAZE & LIMB FRESNEL SCATTERING
  // ========================================================
  if (u_projMode == 0 && u_theme != 4) {
    float limb = 1.0 - viewNormal.z; // 0 at nadir, 1 at curved Earth horizon
    float haze = pow(clamp(limb, 0.0, 1.0), 2.35);
    float rimLine = smoothstep(0.88, 0.998, globeR);

    vec3 hazeCol = u_theme == 1
      ? mix(vec3(0.10, 0.90, 1.00), vec3(0.92, 0.18, 0.84), 0.32)
      : u_theme == 2
      ? vec3(0.22, 0.78, 0.65)
      : u_theme == 3
      ? vec3(0.20, 0.44, 0.88)
      : vec3(0.32, 0.66, 0.98);

    // Subtle dark limb falloff + luminous cyan/blue atmospheric scattering at horizon
    finalColor *= (1.0 - 0.28 * pow(limb, 3.0));
    finalColor = mix(finalColor, hazeCol, haze * 0.42);
    finalColor += hazeCol * rimLine * 0.38;
  }

  // Anti-alias outer edge of projection
  float edgeAlpha = 1.0;
  if (u_projMode == 0) {
    edgeAlpha = 1.0 - smoothstep(0.996, 1.002, globeR);
  }
  gl_FragColor = vec4(finalColor, edgeAlpha);
}
`;

type GLState = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  tex: WebGLTexture;
  hasTex: boolean;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

let sharedGL: GLState | null = null;
let texLoadStarted = false;

function themeToIndex(theme: ThemeId): number {
  switch (theme) {
    case "earth":
      return 0;
    case "cyber":
      return 1;
    case "eco":
      return 2;
    case "night":
      return 3;
    case "paper":
      return 4;
    default:
      return 0;
  }
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function getOrCreateGL(): GLState | null {
  if (typeof document === "undefined") return null;
  if (sharedGL) return sharedGL;

  const canvas = document.createElement("canvas");
  const gl = (canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  }) ||
    canvas.getContext("experimental-webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })) as WebGLRenderingContext | null;

  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  const posLoc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // 1x1 fallback pixel until /earth-sdf.png finishes loading
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([80, 40, 140, 255])
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uniforms: Record<string, WebGLUniformLocation | null> = {
    u_res: gl.getUniformLocation(program, "u_res"),
    u_center: gl.getUniformLocation(program, "u_center"),
    u_scale: gl.getUniformLocation(program, "u_scale"),
    u_rot: gl.getUniformLocation(program, "u_rot"),
    u_theme: gl.getUniformLocation(program, "u_theme"),
    u_projMode: gl.getUniformLocation(program, "u_projMode"),
    u_time: gl.getUniformLocation(program, "u_time"),
    u_hasTex: gl.getUniformLocation(program, "u_hasTex"),
    u_sdfTex: gl.getUniformLocation(program, "u_sdfTex"),
  };

  sharedGL = {
    canvas,
    gl,
    program,
    tex,
    hasTex: false,
    uniforms,
  };

  preloadEarthTexture();
  return sharedGL;
}

let earthTexturePromise: Promise<void> | null = null;
const earthTextureListeners = new Set<() => void>();

export function onEarthTextureReady(cb: () => void): () => void {
  if (sharedGL?.hasTex) {
    cb();
    return () => {};
  }
  earthTextureListeners.add(cb);
  return () => {
    earthTextureListeners.delete(cb);
  };
}

export function preloadEarthTexture(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (earthTexturePromise) return earthTexturePromise;
  texLoadStarted = true;
  earthTexturePromise = new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const state = getOrCreateGL();
      if (state) {
        const { gl, tex } = state;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        state.hasTex = true;
      }
      earthTextureListeners.forEach((fn) => fn());
      earthTextureListeners.clear();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = "/earth-sdf.png";
  });
  return earthTexturePromise;
}

export function drawShaderGlobe(
  ctx: CanvasRenderingContext2D,
  params: {
    w: number;
    h: number;
    cx: number;
    cy: number;
    scale: number;
    rotation: [number, number, number]; // degrees: [rLon, rLat, rGamma]
    theme: ThemeId;
    projMode?: "globe" | "naturalEarth1";
    time?: number;
  }
): boolean {
  const state = getOrCreateGL();
  if (!state) return false;
  if (!texLoadStarted) preloadEarthTexture();
  if (!state.hasTex) return false;

  const { canvas, gl, program, uniforms, tex } = state;
  const { w, h, cx, cy, scale, rotation, theme, projMode = "globe", time = 0 } = params;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(uniforms.u_sdfTex, 0);
  gl.uniform1f(uniforms.u_hasTex, state.hasTex ? 1.0 : 0.0);
  gl.uniform2f(uniforms.u_res, w, h);
  gl.uniform2f(uniforms.u_center, cx, cy);
  gl.uniform1f(uniforms.u_scale, scale);
  gl.uniform3f(
    uniforms.u_rot,
    (rotation[0] * Math.PI) / 180,
    (rotation[1] * Math.PI) / 180,
    (rotation[2] * Math.PI) / 180
  );
  gl.uniform1i(uniforms.u_theme, themeToIndex(theme));
  gl.uniform1i(uniforms.u_projMode, projMode === "naturalEarth1" ? 1 : 0);
  gl.uniform1f(uniforms.u_time, time);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  ctx.drawImage(canvas, 0, 0, w, h);
  return true;
}
