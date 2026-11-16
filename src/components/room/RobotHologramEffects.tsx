import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBeamSegment, PANEL_POSITION, PROJECTOR_ORIGIN, PROJECTION_BEAM_LENGTH } from './projection-layout';

type ProjectionMode = 'deploying' | 'live' | 'dismissing';

const PANEL_WIDTH = 0.92;
const PANEL_HEIGHT = 0.63;
const BEAM_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewPosition = -viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const BEAM_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPosition;

  void main() {
    float facing = abs(dot(normalize(vNormalView), normalize(vViewPosition)));
    float fresnel = pow(1.0 - facing, 1.65);
    float scan = pow(max(0.0, sin(vUv.y * 132.0 - uTime * 4.8)), 16.0);
    float pulse = pow(max(0.0, sin(vUv.y * 24.0 - uTime * 2.2)), 5.0);
    float interference = 0.5 + 0.5 * sin(vUv.x * 21.0 + vUv.y * 74.0 - uTime * 1.4);
    float endFade = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y));
    float alpha = (0.12 + fresnel * 0.52 + scan * 0.20 + pulse * interference * 0.17) * endFade * uOpacity;
    vec3 cyan = vec3(0.20, 0.86, 1.0);
    vec3 blue = vec3(0.22, 0.52, 1.0);
    vec3 color = mix(cyan, blue, 0.5 + 0.5 * sin(vUv.y * 5.0 - uTime * 0.7));

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.88));
  }
`;

const PANEL_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float frame = 1.0 - smoothstep(0.0, 0.025, edge);
    float scan = pow(max(0.0, sin(vUv.y * 76.0 - uTime * 0.16)), 22.0);
    float gridX = smoothstep(0.985, 1.0, sin(vUv.x * 188.0));
    float gridY = smoothstep(0.992, 1.0, sin(vUv.y * 112.0));
    float dataFlicker = 0.5 + 0.5 * sin(vUv.x * 19.0 + vUv.y * 28.0 + uTime * 0.55);
    vec3 cyan = vec3(0.12, 0.76, 0.95);
    vec3 blue = vec3(0.15, 0.40, 0.78);
    vec3 color = mix(blue, cyan, dataFlicker * 0.45);
    float alpha = (0.07 + frame * 0.24 + scan * 0.18 + max(gridX, gridY) * 0.035) * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

interface RobotHologramEffectsProps {
  mode: ProjectionMode;
}

export default function RobotHologramEffects({ mode }: RobotHologramEffectsProps) {
  const beamProgress = useRef(mode === 'dismissing' ? 1 : 0);
  const beamUniforms = useRef<{ uTime: { value: number }; uOpacity: { value: number } }>(null);
  const panelUniforms = useRef<{ uTime: { value: number }; uOpacity: { value: number } }>(null);
  const pulseRings = useRef<Array<THREE.Mesh | null>>([]);
  const mouthRings = useRef<Array<THREE.Mesh | null>>([]);
  const beamMesh = useRef<THREE.Mesh>(null);
  const frameMaterials = useRef<THREE.MeshBasicMaterial[]>([]);
  const pulseMaterials = useRef<THREE.MeshBasicMaterial[]>([]);
  const reducedMotion = useRef(false);
  const beamGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.10, 0.032, 1, 20, 24, true),
    [],
  );
  const beamMaterial = useMemo(() => {
    const uniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    };
    beamUniforms.current = uniforms;
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: BEAM_VERTEX_SHADER,
      fragmentShader: BEAM_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
  }, []);
  const panelMaterial = useMemo(() => {
    const uniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    };
    panelUniforms.current = uniforms;
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: BEAM_VERTEX_SHADER,
      fragmentShader: PANEL_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
  }, []);
  const frameMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#69e9ff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), []);
  const glowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#28bfe9',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), []);
  const casingMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#123746',
    emissive: '#0a607c',
    emissiveIntensity: 0.42,
    metalness: 0.62,
    roughness: 0.21,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }), []);
  const pulseMaterialSet = useMemo(
    () => Array.from({ length: 3 }, () => new THREE.MeshBasicMaterial({
      color: '#a7f7ff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })),
    [],
  );
  const orientation = useMemo(() => {
    const direction = new THREE.Vector3(...PANEL_POSITION)
      .sub(new THREE.Vector3(...PROJECTOR_ORIGIN))
      .normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  }, []);
  const beamLength = PROJECTION_BEAM_LENGTH;
  const frameBars = useMemo(() => [
    { position: [0, PANEL_HEIGHT / 2, 0] as [number, number, number], size: [PANEL_WIDTH + 0.035, 0.009, 0.026] as [number, number, number] },
    { position: [0, -PANEL_HEIGHT / 2, 0] as [number, number, number], size: [PANEL_WIDTH + 0.035, 0.009, 0.026] as [number, number, number] },
    { position: [PANEL_WIDTH / 2, 0, 0] as [number, number, number], size: [0.009, PANEL_HEIGHT, 0.026] as [number, number, number] },
    { position: [-PANEL_WIDTH / 2, 0, 0] as [number, number, number], size: [0.009, PANEL_HEIGHT, 0.026] as [number, number, number] },
  ], []);
  const progressTarget = mode === 'dismissing' ? 0 : 1;

  useEffect(() => () => {
    beamGeometry.dispose();
    beamMaterial.dispose();
    panelMaterial.dispose();
    frameMaterial.dispose();
    glowMaterial.dispose();
    casingMaterial.dispose();
    for (const material of pulseMaterialSet) material.dispose();
  }, [beamGeometry, beamMaterial, casingMaterial, frameMaterial, glowMaterial, panelMaterial, pulseMaterialSet]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      reducedMotion.current = preference.matches;
    };
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useFrame(({ clock }, delta) => {
    const time = reducedMotion.current ? 0 : clock.elapsedTime;
    beamProgress.current = reducedMotion.current
      ? progressTarget
      : THREE.MathUtils.damp(beamProgress.current, progressTarget, 4.2, delta);

    if (beamUniforms.current) {
      beamUniforms.current.uTime.value = time;
      beamUniforms.current.uOpacity.value = beamProgress.current;
    }
    if (panelUniforms.current) {
      panelUniforms.current.uTime.value = time;
      panelUniforms.current.uOpacity.value = beamProgress.current;
    }

    glowMaterial.opacity = 0.42 * beamProgress.current;
    casingMaterial.opacity = 0.72 * beamProgress.current;
    frameMaterial.opacity = 0.82 * beamProgress.current;
    for (const material of frameMaterials.current) {
      material.opacity = 0.72 * beamProgress.current;
    }

    const { length: activeLength, centerOffset } = getBeamSegment(beamProgress.current);
    if (beamMesh.current) {
      beamMesh.current.position.y = centerOffset;
      beamMesh.current.scale.y = activeLength;
    }
    for (let index = 0; index < pulseRings.current.length; index += 1) {
      const ring = pulseRings.current[index];
      const material = pulseMaterials.current[index];
      if (!ring || !material) continue;
      const phase = (time * 0.42 + index / 3) % 1;
      ring.position.y = 0.045 + phase * Math.max(0, activeLength - 0.08);
      ring.scale.setScalar(0.5 + phase);
      material.opacity = Math.sin(Math.PI * phase) * 0.72 * beamProgress.current;
    }

    for (let index = 0; index < mouthRings.current.length; index += 1) {
      const ring = mouthRings.current[index];
      if (!ring) continue;
      const phase = (time * 0.68 + index * 0.5) % 1;
      ring.scale.setScalar(0.55 + phase * 1.35);
      const material = ring.material as THREE.MeshBasicMaterial;
      material.opacity = (1 - phase) * 0.7 * beamProgress.current;
    }
  });

  return (
    <>
      <group position={PROJECTOR_ORIGIN} quaternion={orientation} renderOrder={7}>
        <mesh ref={beamMesh} position={[0, beamLength / 2, 0]} scale={[1, 0, 1]} renderOrder={7}>
          <primitive object={beamGeometry} attach="geometry" />
          <primitive object={beamMaterial} attach="material" />
        </mesh>
        {pulseMaterialSet.map((material, index) => (
          <mesh
            key={`wave-${index}`}
            ref={(element) => { pulseRings.current[index] = element; }}
            position={[0, beamLength * (index + 1) / 4, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            renderOrder={8}
          >
            <torusGeometry args={[0.068, 0.0028, 6, 32]} />
            <primitive object={material} attach="material" />
          </mesh>
        ))}
      </group>

      <group position={PROJECTOR_ORIGIN} renderOrder={9}>
        {[0, 1, 2].map((index) => (
          <mesh
            key={`emitter-wave-${index}`}
            ref={(element) => { mouthRings.current[index] = element; }}
            position={[0, 0, 0.008 + index * 0.001]}
            renderOrder={9}
          >
            <torusGeometry args={[0.030, 0.0026, 6, 32]} />
            <meshBasicMaterial
              color={index === 1 ? '#b8fbff' : '#45dcff'}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        ))}
        <mesh position={[0, 0, -0.029]} renderOrder={7}>
          <sphereGeometry args={[0.022, 20, 12]} />
          <primitive object={glowMaterial} attach="material" />
        </mesh>
      </group>

      <group position={PANEL_POSITION} renderOrder={7}>
        <mesh position={[0, 0, -0.031]} renderOrder={7}>
          <boxGeometry args={[PANEL_WIDTH + 0.05, PANEL_HEIGHT + 0.05, 0.045]} />
          <primitive object={casingMaterial} attach="material" />
        </mesh>
        <mesh position={[0, 0, -0.004]} renderOrder={8}>
          <planeGeometry args={[PANEL_WIDTH, PANEL_HEIGHT, 1, 1]} />
          <primitive object={panelMaterial} attach="material" />
        </mesh>
        {frameBars.map((bar, index) => (
          <mesh
            key={`frame-${index}`}
            position={[bar.position[0], bar.position[1], 0.006]}
            ref={(element) => {
              if (element) frameMaterials.current[index] = element.material as THREE.MeshBasicMaterial;
            }}
            renderOrder={9}
          >
            <boxGeometry args={bar.size} />
            <primitive object={frameMaterial} attach="material" />
          </mesh>
        ))}
        {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([x, y], index) => (
          <mesh
            key={`corner-${index}`}
            position={[x * (PANEL_WIDTH / 2 - 0.018), y * (PANEL_HEIGHT / 2 - 0.018), 0.012]}
            scale={0.72}
            renderOrder={10}
          >
            <sphereGeometry args={[0.009, 8, 8]} />
            <meshBasicMaterial
              color="#b5fbff"
              transparent
              opacity={0.76}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}
