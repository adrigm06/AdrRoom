import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeRoomObjectName } from '../src/components/room/model-object-names.js';

interface GltfDocument {
  asset: { version: string };
  nodes: { name?: string; mesh?: number; translation?: number[]; rotation?: number[]; matrix?: number[] }[];
  accessors: { count: number; bufferView: number; byteOffset?: number; componentType: number }[];
  meshes: { primitives: { indices: number; mode?: number; attributes: { POSITION: number } }[] }[];
  materials: {
    name?: string;
    normalTexture?: { index: number };
    pbrMetallicRoughness?: {
      baseColorTexture?: { index: number };
      metallicFactor?: number;
      roughnessFactor?: number;
    };
  }[];
  textures: { source: number }[];
  images: { name?: string; mimeType: string; bufferView: number }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  animations: {
    name?: string;
    channels: { target: { node: number; path: string } }[];
  }[];
}

const binary = readFileSync(new URL('../public/models/room.glb', import.meta.url));
const document = JSON.parse(binary.subarray(20, 20 + binary.readUInt32LE(12)).toString()) as GltfDocument;
const names = new Set(document.nodes.map((node) => node.name));

describe('room model runtime contracts', () => {
  it('normalizes both Blender names and GLTFLoader-safe names for hover matching', () => {
    for (const [source, loaded, expected] of [
      ['Monitor | bezel', 'Monitor_|_bezel', 'monitor bezel'],
      ['Robot pet | rounded shell', 'Robot_pet_|_rounded_shell', 'robot pet rounded shell'],
      ['Window | panorama depth mask', 'Window_|_panorama_depth_mask', 'window panorama depth mask'],
    ]) {
      expect(normalizeRoomObjectName(source)).toBe(expected);
      expect(normalizeRoomObjectName(loaded)).toBe(expected);
    }
  });

  it('ships a complete glTF 2 binary with named interaction and animation meshes', () => {
    expect(binary.subarray(0, 4).toString()).toBe('glTF');
    expect(binary.readUInt32LE(4)).toBe(2);
    expect(binary.readUInt32LE(8)).toBe(binary.length);
    expect(document.asset.version).toBe('2.0');
    for (const name of [
      'Monitor | bezel',
      'Robot pet | rounded shell',
      'Robot pet | face screen',
      'Robot pet | eye',
      'Robot pet | eye.001',
      'Robot pet | projection jaw',
      'Window | panorama depth mask',
    ]) expect(names.has(name), name).toBe(true);
  });

  it('animates the actual robot jaw and does not lose the projection clip', () => {
    const clip = document.animations.find((animation) => animation.name === 'AN_Robot_Mouth_Projection');
    expect(clip).toBeDefined();
    expect(clip?.channels.some((channel) => (
      channel.target.path === 'rotation'
      && document.nodes[channel.target.node].name === 'Robot pet | projection jaw'
    ))).toBe(true);
  });

  it('retires the redundant monitor layers instead of stacking another display over them', () => {
    expect(names.has('Monitor | active display')).toBe(false);
    expect(names.has('Monitor | wallpaper landscape')).toBe(false);
    expect([...names].some((name) => name?.startsWith('Monitor detail |'))).toBe(true);
  });

  it('includes each refined asset and portable image-based wood and upholstery materials', () => {
    for (const prefix of ['Chair detail |', 'Desk detail |', 'Robot detail |', 'Tree detail |', 'Desk foliage |']) {
      expect([...names].some((name) => name?.startsWith(prefix)), prefix).toBe(true);
    }
    for (const name of ['MAT_Wood | detailed walnut grain', 'MAT_Detail | woven graphite upholstery']) {
      const mat = document.materials.find((item) => item.name === name);
      expect(mat?.pbrMetallicRoughness?.baseColorTexture, name).toBeDefined();
    }
  });

  it('includes the environment pass without the overlapping old shelf and fine-thread meshes', () => {
    for (const prefix of [
      'Library detail |', 'Library books |', 'Library ornaments |', 'Library vine |',
      'Window detail |', 'Floor detail |', 'Art detail |', 'Cork detail |',
      'Curtain detail |', 'Lamp detail |',
    ]) {
      expect([...names].some((name) => name?.startsWith(prefix)), prefix).toBe(true);
    }
    for (const prefix of [
      'Bookcase |', 'Book |', 'Shelf |', 'Headphones |',
      'Rug | woven thread', 'Curtain | vertical pleat',
    ]) {
      expect([...names].some((name) => name?.startsWith(prefix)), prefix).toBe(false);
    }
    expect(names.has('Rug | main pile')).toBe(true);
  });

  it('preserves five clear nonmetallic window panes and the distant panorama', () => {
    expect([...names].filter((name) => name?.startsWith('Window glass | insulated pane'))).toHaveLength(5);
    expect(names.has('Window | Málaga panorama')).toBe(true);
    const glass = document.materials.find((mat) => mat.name === 'MAT_Glass | blue dusk');
    expect(glass).toBeDefined();
    expect(glass?.pbrMetallicRoughness?.metallicFactor ?? 1).toBe(0);
    expect(glass?.pbrMetallicRoughness?.roughnessFactor).toBeCloseTo(0.025);
  });

  it('shares one compact photo atlas between the art and corkboard', () => {
    const prints = document.materials.filter((mat) => mat.name === 'MAT_Print | room portfolio atlas');
    expect(prints).toHaveLength(1);
    const textureIndex = prints[0].pbrMetallicRoughness?.baseColorTexture?.index;
    expect(textureIndex).toBeDefined();
    const image = document.images[document.textures[textureIndex!].source];
    expect(image.name).toBe('room-prints');
    expect(image.mimeType).toBe('image/jpeg');
    expect(document.images.filter((item) => item.name === 'room-prints')).toHaveLength(1);
  });

  it('keeps normal maps lossless, small and separate from color textures', () => {
    const binOffset = 20 + binary.readUInt32LE(12) + 8;
    for (const mat of document.materials.filter((item) => item.normalTexture)) {
      const image = document.images[document.textures[mat.normalTexture!.index].source];
      expect(image.mimeType, image.name).toBe('image/png');
      const view = document.bufferViews[image.bufferView];
      const offset = binOffset + (view.byteOffset ?? 0);
      expect(binary.readUInt32BE(offset + 16), image.name).toBeLessThanOrEqual(256);
      expect(binary.readUInt32BE(offset + 20), image.name).toBeLessThanOrEqual(256);
      expect(mat.normalTexture?.index).not.toBe(mat.pbrMetallicRoughness?.baseColorTexture?.index);
    }
    expect(document.materials.filter((item) => item.normalTexture).length).toBeGreaterThan(5);
    expect(binary.length).toBeLessThanOrEqual(10_000_000);
  });

  it('covers the left floor edge in all 20 rows instead of omitting alternate half-boards', () => {
    const floor = document.nodes.find((node) => node.name?.startsWith('Floor detail |'));
    expect(floor).toBeDefined();
    // Static floor batching bakes board rotations/scales into a translated mesh.
    expect(floor?.rotation).toBeUndefined();
    expect(floor?.matrix).toBeUndefined();
    const translation = floor!.translation ?? [0, 0, 0];
    const primitive = document.meshes[floor!.mesh!].primitives[0];
    const binOffset = 20 + binary.readUInt32LE(12) + 8;
    const positions = document.accessors[primitive.attributes.POSITION];
    expect(positions.componentType).toBe(5126);
    const pv = document.bufferViews[positions.bufferView];
    const indices = document.accessors[primitive.indices];
    const iv = document.bufferViews[indices.bufferView];
    expect([5123, 5125]).toContain(indices.componentType);
    const indexSize = indices.componentType === 5125 ? 4 : 2;
    const index = (i: number) => {
      const offset = binOffset + (iv.byteOffset ?? 0) + (indices.byteOffset ?? 0) + i * indexSize;
      return indexSize === 4 ? binary.readUInt32LE(offset) : binary.readUInt16LE(offset);
    };
    const vertex = (i: number) => {
      const offset = binOffset + (pv.byteOffset ?? 0) + (positions.byteOffset ?? 0) + i * (pv.byteStride ?? 12);
      return [0, 1, 2].map((axis) => binary.readFloatLE(offset + axis * 4) + translation[axis]);
    };
    const topTriangles: number[][][] = [];
    for (let i = 0; i < indices.count; i += 3) {
      const triangle = [vertex(index(i)), vertex(index(i + 1)), vertex(index(i + 2))];
      if (triangle.every((v) => Math.abs(v[1] - 0.0245) < 0.0001)) topTriangles.push(triangle);
    }
    for (let row = 0; row < 20; row++) {
      const x = -3.2;
      const z = 2.28 - row * 0.235;
      const covered = topTriangles.some((triangle) => {
        const signs = triangle.map((a, i) => {
          const b = triangle[(i + 1) % 3];
          return (b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0]);
        });
        return signs.every((sign) => sign >= -1e-8) || signs.every((sign) => sign <= 1e-8);
      });
      expect(covered, `Missing floor at left edge of row ${row}`).toBe(true);
    }
  });

  it('keeps evaluated triangle and material budgets bounded after static detail batching', () => {
    let triangles = 0;
    for (const mesh of document.meshes) {
      for (const primitive of mesh.primitives) {
        expect(primitive.mode ?? 4).toBe(4);
        triangles += document.accessors[primitive.indices].count / 3;
      }
    }
    expect(triangles).toBeLessThanOrEqual(180_000);
    expect(document.meshes.length).toBeLessThan(634);
    expect(document.materials.length).toBeLessThanOrEqual(75);
  });
});
