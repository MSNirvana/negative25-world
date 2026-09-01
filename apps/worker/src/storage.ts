import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type StoredImage = {
  key: string;
  body: Uint8Array;
  contentType: string;
};

export interface ObjectStorage {
  getObject(key: string): Promise<Uint8Array>;
  putObject(object: StoredImage): Promise<void>;
}

export type S3ObjectStorageOptions = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly options: S3ObjectStorageOptions) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: true,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  async getObject(key: string): Promise<Uint8Array> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: key }));
    if (!response.Body) throw new Error(`Source object is empty: ${key}`);
    return response.Body.transformToByteArray();
  }

  async putObject(object: StoredImage): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.options.bucket, Key: object.key, Body: object.body, ContentType: object.contentType }));
  }
}

export class MemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, StoredImage>();

  constructor(objects: StoredImage[] = []) {
    for (const object of objects) this.objects.set(object.key, { ...object, body: new Uint8Array(object.body) });
  }

  async getObject(key: string): Promise<Uint8Array> {
    const object = this.objects.get(key);
    if (!object) throw new Error(`Source object not found: ${key}`);
    return new Uint8Array(object.body);
  }

  async putObject(object: StoredImage): Promise<void> {
    this.objects.set(object.key, { ...object, body: new Uint8Array(object.body) });
  }

  get(key: string): StoredImage | undefined {
    const object = this.objects.get(key);
    return object ? { ...object, body: new Uint8Array(object.body) } : undefined;
  }
}

export function createObjectStorageFromEnv(env: NodeJS.ProcessEnv = process.env): ObjectStorage {
  const { S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  if (S3_ENDPOINT && S3_BUCKET && S3_REGION && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY) {
    return new S3ObjectStorage({ endpoint: S3_ENDPOINT, bucket: S3_BUCKET, region: S3_REGION, accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY });
  }
  return new MemoryObjectStorage();
}
