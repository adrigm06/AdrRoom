import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const modelPath = path.join(root, 'public', 'models', 'room.glb');
const atlasPath = path.join(root, 'models', 'textures', 'room-prints.jpg');
const source = await readFile(modelPath);
const atlas = await readFile(atlasPath);

if (source.toString('ascii', 0, 4) !== 'glTF' || source.readUInt32LE(4) !== 2) {
  throw new Error('Expected a glTF 2 binary room model');
}

const chunks = [];
let offset = 12;
while (offset < source.length) {
  const length = source.readUInt32LE(offset);
  const type = source.readUInt32LE(offset + 4);
  const data = source.subarray(offset + 8, offset + 8 + length);
  if (data.length !== length) throw new Error('Truncated GLB chunk');
  chunks.push({ type, data });
  offset += 8 + length;
}

const jsonChunk = chunks.find((chunk) => chunk.type === 0x4e4f534a);
const binChunk = chunks.find((chunk) => chunk.type === 0x004e4942);
if (!jsonChunk || !binChunk) throw new Error('GLB must contain JSON and BIN chunks');

const document = JSON.parse(jsonChunk.data.toString('utf8').trimEnd());
const image = document.images.find((entry) => entry.name === 'room-prints');
if (!image || image.mimeType !== 'image/jpeg') {
  throw new Error('Expected the embedded JPEG image named "room-prints"');
}
const view = document.bufferViews[image.bufferView];
if (!view || view.buffer !== 0) throw new Error('Atlas must reference the primary GLB buffer');
if ((view.byteOffset ?? 0) + view.byteLength > binChunk.data.length) {
  throw new Error('Current embedded atlas extends beyond the GLB binary chunk');
}

const viewBlocks = [];
let nextOffset = 0;
for (const { index: viewIndex, entry: bufferView } of document.bufferViews
  .map((entry, index) => ({ entry, index }))
  .sort((a, b) => (a.entry.byteOffset ?? 0) - (b.entry.byteOffset ?? 0))) {
  if (bufferView.buffer !== 0) throw new Error('All room model buffer views must use the primary buffer');

  const alignedOffset = (nextOffset + 3) & ~3;
  if (alignedOffset > nextOffset) viewBlocks.push(Buffer.alloc(alignedOffset - nextOffset));
  const previousOffset = bufferView.byteOffset ?? 0;
  const contents = viewIndex === image.bufferView
    ? atlas
    : binChunk.data.subarray(previousOffset, previousOffset + bufferView.byteLength);
  if (contents.length !== (viewIndex === image.bufferView ? atlas.length : bufferView.byteLength)) {
    throw new Error(`Truncated buffer view ${viewIndex}`);
  }
  bufferView.byteOffset = alignedOffset;
  if (viewIndex === image.bufferView) bufferView.byteLength = atlas.length;
  viewBlocks.push(contents);
  nextOffset = alignedOffset + contents.length;
}
document.buffers[0].byteLength = nextOffset;
const nextBinary = Buffer.concat(viewBlocks, (nextOffset + 3) & ~3);

const json = Buffer.from(JSON.stringify(document));
const paddedJson = Buffer.alloc((json.length + 3) & ~3, 0x20);
json.copy(paddedJson);
const totalLength = 12 + 8 + paddedJson.length + 8 + nextBinary.length;
const output = Buffer.alloc(totalLength);
output.write('glTF', 0, 'ascii');
output.writeUInt32LE(2, 4);
output.writeUInt32LE(totalLength, 8);
output.writeUInt32LE(paddedJson.length, 12);
output.writeUInt32LE(0x4e4f534a, 16);
paddedJson.copy(output, 20);
const binHeader = 20 + paddedJson.length;
output.writeUInt32LE(nextBinary.length, binHeader);
output.writeUInt32LE(0x004e4942, binHeader + 4);
nextBinary.copy(output, binHeader + 8);

const temporaryPath = `${modelPath}.tmp`;
await writeFile(temporaryPath, output);
await rename(temporaryPath, modelPath);
console.log(`Embedded ${atlas.length} atlas bytes in ${path.relative(root, modelPath)}`);
