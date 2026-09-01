import sharp from 'sharp';

export type VariantKind = 'thumbnail' | 'preview' | 'large';
export type GeneratedVariant = { kind: VariantKind; width: number; height: number; format: 'jpeg'; contentType: 'image/jpeg'; body: Buffer; byteSize: number };

const specs: readonly [VariantKind, number][] = [['thumbnail', 480], ['preview', 1280], ['large', 2400]];

export async function generateVariants(input: Uint8Array): Promise<GeneratedVariant[]> {
  const variants: GeneratedVariant[] = [];
  for (const [kind, width] of specs) {
    const result = await sharp(input).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: 84, progressive: true }).toBuffer({ resolveWithObject: true });
    variants.push({ kind, width: result.info.width, height: result.info.height, format: 'jpeg', contentType: 'image/jpeg', body: result.data, byteSize: result.data.byteLength });
  }
  return variants;
}
