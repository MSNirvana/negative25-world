import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StoredObject = {
  key: string;
  size: number;
  contentType: string;
  etag?: string;
};

export type UploadUrlInput = {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
};

export interface StorageAdapter {
  createUploadUrl(input: UploadUrlInput): Promise<string>;
  headObject(key: string): Promise<StoredObject | null>;
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getPublicUrl(key: string): string;
  putObject(object: StoredObject & { body: Uint8Array }): Promise<void>;
  deleteObject(key: string): Promise<void>;
  listPrefix(prefix: string): Promise<StoredObject[]>;
}

export type S3StorageOptions = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
};

export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.publicBaseUrl = options.publicBaseUrl ?? `${options.endpoint.replace(/\/$/, '')}/${options.bucket}`;
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: true,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  async createUploadUrl(input: UploadUrlInput): Promise<string> {
    return getSignedUrl(this.client, new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ContentType: input.contentType,
      // Explicitly omit ACLs. Bucket policy controls public preview access.
    }), { expiresIn: input.expiresInSeconds ?? 900 });
  }

  async headObject(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { key, size: Number(result.ContentLength ?? 0), contentType: result.ContentType ?? 'application/octet-stream', etag: result.ETag };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || (error as { name?: string }).name === 'NotFound') return null;
      throw error;
    }
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSeconds });
  }

  getPublicUrl(key: string): string { return `${this.publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`; }

  async putObject(object: StoredObject & { body: Uint8Array }): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: object.key, Body: object.body, ContentType: object.contentType }));
  }

  async deleteObject(key: string): Promise<void> { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })); }

  async listPrefix(prefix: string): Promise<StoredObject[]> {
    const result = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix }));
    return (result.Contents ?? []).map((item) => ({ key: item.Key ?? '', size: Number(item.Size ?? 0), contentType: 'application/octet-stream', etag: item.ETag })).filter((item) => item.key);
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly objects = new Map<string, StoredObject & { body: Uint8Array }>();

  async createUploadUrl(input: UploadUrlInput): Promise<string> { return `memory://upload/${encodeURIComponent(input.key)}`; }

  async headObject(key: string): Promise<StoredObject | null> {
    const object = this.objects.get(key);
    return object ? { key: object.key, size: object.size, contentType: object.contentType, etag: object.etag } : null;
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    if (!this.objects.has(key)) throw new Error(`Object not found: ${key}`);
    return `memory://download/${encodeURIComponent(key)}`;
  }

  getPublicUrl(key: string): string { return `memory://public/${encodeURIComponent(key)}`; }

  async putObject(object: StoredObject & { body: Uint8Array }): Promise<void> { this.objects.set(object.key, object); }
  async deleteObject(key: string): Promise<void> { this.objects.delete(key); }
  async listPrefix(prefix: string): Promise<StoredObject[]> { return [...this.objects.values()].filter((item) => item.key.startsWith(prefix)).map(({ body: _body, ...item }) => item); }
}
