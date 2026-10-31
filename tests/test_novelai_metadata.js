const assert = require('assert');
const fs = require('fs');
const zlib = require('zlib');
const { parsePNGTextChunks, normalize, read, parseStealthBytes, createMetadataPNG, writeMetadataPNG, stripPublicMetadata } = require('../novelai-metadata.js');

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function chunk(type, data) {
  const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(body.length, 0);
  header.write(type, 4, 4, 'ascii');
  return Buffer.concat([header, body, Buffer.alloc(4)]);
}
function textChunk(key, value) {
  return chunk('tEXt', Buffer.concat([Buffer.from(key, 'latin1'), Buffer.from([0]), Buffer.from(value, 'latin1')]));
}
function chunkData(input, wantedType) {
  let offset = 8;
  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString('latin1', offset + 4, offset + 8);
    const data = input.subarray(offset + 8, offset + 8 + length);
    if (type === wantedType) return data;
    offset += length + 12;
  }
  return null;
}
function sampleComment() {
  return JSON.stringify({
    prompt: 'legacy prompt',
    uc: 'lowres, blurry',
    model_name: 'nai-diffusion-5-full',
    width: 832,
    height: 1216,
    steps: 28,
    scale: 5.5,
    seed: 123456,
    sampler: 'k_euler_ancestral',
    noise_schedule: 'karras',
    v4_prompt: {
      caption: {
        base_caption: 'base scene, masterpiece',
        char_captions: [
          { char_caption: 'girl, red hair', centers: [{ x: 0.25, y: 0.5 }] },
          { char_caption: 'boy, black hair', centers: [{ x: 0.75, y: 0.5 }] },
          { char_caption: 'third character', centers: [{ x: 0.5, y: 0.5 }] }
        ]
      }
    },
    v4_negative_prompt: { caption: { base_caption: 'bad anatomy' } },
    request_type: 'PromptGenerateRequest'
  });
}

(async () => {
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  for (const id of ['metadataPanel', 'chooseMetadataFile', 'metadataInspectOnly', 'seed', 'copySeed', 'clearSeed', 'applyMetadata', 'restoreMetadata', 'copyMetadataJson', 'exportMetadataPNG', 'exportPublicPNG']) {
    assert.ok(html.includes(`id="${id}"`), `metadata UI missing: ${id}`);
  }
  assert.ok(html.includes('<script src="./novelai-metadata.js"></script>'));
  assert.ok(html.includes('確認モード（フォームへ反映しない）'));
  assert.ok(html.includes('!importedNovelAIMetadata.isNovelAI'));
  assert.ok(html.includes("stateIds=['character','outfit'"));
  assert.ok(html.includes("'negative','seed','useQuality'"));
  assert.ok(html.includes('function exportNovelAIMetadataPNG()'));
  assert.ok(html.includes('async function exportPublicPNG()'));
  assert.ok(html.includes('公開用PNGを保存（生成情報なし）'));
  assert.ok(html.includes("const PANEL_KEYS=['presets','style','character','pov','extraTags','outputs','metadata'"));
  assert.ok(html.includes('「適用前の状態に戻す」で復元できます'));

  const png = Buffer.concat([signature, textChunk('Software', 'NovelAI'), textChunk('Source', 'NovelAI Diffusion V5'), textChunk('Comment', sampleComment()), chunk('IEND', '')]);
  const parsed = await parsePNGTextChunks(png);
  assert.strictEqual(parsed.fields.Software, 'NovelAI');
  assert.strictEqual(JSON.parse(parsed.fields.Comment).v4_prompt.caption.char_captions.length, 3);

  const normalized = normalize(parsed.fields, JSON.parse(parsed.fields.Comment), 'png-text');
  assert.strictEqual(normalized.isNovelAI, true);
  assert.strictEqual(normalized.basePrompt, 'base scene, masterpiece');
  assert.strictEqual(normalized.negativePrompt, 'bad anatomy');
  assert.strictEqual(normalized.characters.length, 3);
  assert.deepStrictEqual(normalized.characters[1].centers[0], { x: 0.75, y: 0.5 });
  assert.strictEqual(normalized.settings.seed, 123456);
  assert.strictEqual(normalized.settings.sampler, 'k_euler_ancestral');

  const file = { name: 'sample.png', type: 'image/png', arrayBuffer: async () => png };
  const fromFile = await read(file);
  assert.strictEqual(fromFile.fileName, undefined);
  assert.strictEqual(fromFile.source, 'png-text');
  assert.strictEqual(fromFile.characters.length, 3);

  const raw = Buffer.from(JSON.stringify({ Comment: JSON.stringify({ prompt: 'stealth prompt', uc: 'stealth uc', width: 512 }) }));
  const compressed = zlib.gzipSync(raw);
  const magic = Buffer.from('stealth_pngcomp', 'ascii');
  const bitLength = Buffer.alloc(4);
  bitLength.writeUInt32BE(compressed.length * 8, 0);
  const stealth = Buffer.concat([magic, bitLength, compressed]);
  const stealthResult = await parseStealthBytes(stealth);
  assert.strictEqual(stealthResult.comment.prompt, 'stealth prompt');
  assert.strictEqual(stealthResult.comment.uc, 'stealth uc');

  const exportMetadata = { metadata_type: 'nai-studio-export', exported_by: 'NAI Studio', seed: 777, prompt: 'base, 青い瞳', uc: 'lowres', v4_prompt: { caption: { base_caption: 'base, 青い瞳', char_captions: [{ char_caption: 'girl, 赤髪', centers: [] }] } }, v4_negative_prompt: { caption: { base_caption: 'lowres' } } };
  const exported = createMetadataPNG(exportMetadata);
  assert.deepStrictEqual(zlib.inflateSync(Buffer.from(chunkData(Buffer.from(exported), 'IDAT'))), Buffer.from([0, 255, 255, 255, 0]));
  const exportedFields = (await parsePNGTextChunks(exported)).fields;
  assert.strictEqual(exportedFields.Software, 'NAI Studio (NovelAI-compatible metadata export)');
  assert.strictEqual(JSON.parse(exportedFields.Comment).metadata_type, 'nai-studio-export');
  assert.strictEqual(JSON.parse(exportedFields.Comment).seed, 777);
  const roundTrip = await read({ name: 'nai-studio.png', type: 'image/png', arrayBuffer: async () => exported });
  assert.strictEqual(roundTrip.raw.metadata_type, 'nai-studio-export');
  assert.strictEqual(roundTrip.settings.seed, 777);
  assert.strictEqual(roundTrip.basePrompt, 'base, 青い瞳');
  const rewritten = writeMetadataPNG(exported, { ...exportMetadata, seed: 778 });
  assert.strictEqual(JSON.parse((await parsePNGTextChunks(rewritten)).fields.Comment).seed, 778);
  assert.deepStrictEqual(zlib.inflateSync(Buffer.from(chunkData(Buffer.from(rewritten), 'IDAT'))), Buffer.from([0, 255, 255, 255, 0]));

  const publicPng = stripPublicMetadata(exported);
  const publicFields = (await parsePNGTextChunks(publicPng)).fields;
  assert.deepStrictEqual(publicFields, {});
  assert.strictEqual((await read({ name: 'sample_public.png', type: 'image/png', arrayBuffer: async () => publicPng })).hasMetadata, false);
  assert.ok(Buffer.from(publicPng).includes(Buffer.from('IDAT')));

  const emptyPng = Buffer.concat([signature, chunk('IEND', '')]);
  const empty = await read({ name: 'empty.png', type: 'image/png', arrayBuffer: async () => emptyPng });
  assert.strictEqual(empty.hasMetadata, false);
  console.log('NovelAI PNG text/stealth metadata contract: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
