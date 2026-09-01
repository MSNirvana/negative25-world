import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'node:crypto';

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

export type MultipartPart = { partNumber: number; etag: string; size: number };

export type MultipartUploadInput = {
  key: string;
  contentType: string;
};

export type MultipartPartUrlInput = {
  key: string;
  uploadId: string;
  partNumber: number;
  expiresInSeconds?: number;
};

export type CompleteMultipartInput = {
  key: string;
  uploadId: string;
  parts: Array<{ partNumber: number; etag: string }>;
};

export interface StorageAdapter {
  createUploadUrl(input: UploadUrlInput): Promise<string>;
  createMultipartUpload(input: MultipartUploadInput): Promise<{ uploadId: string }>;
  createPartUploadUrl(input: MultipartPartUrlInput): Promise<string>;
  listParts(key: string, uploadId: string): Promise<MultipartPart[]>;
  completeMultipartUpload(input: CompleteMultipartInput): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
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
  publicEndpoint?: string;
  publicBaseUrl?: string;
};

export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly signingClient: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly publicPathPrefix: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.publicBaseUrl = options.publicBaseUrl ?? `${options.endpoint.replace(/\/$/, '')}/${options.bucket}`;
    const publicEndpoint = new URL(options.publicEndpoint ?? options.endpoint);
    this.publicPathPrefix = publicEndpoint.pathname.replace(/\/$/, '');
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: true,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
    this.signingClient = new S3Client({
      endpoint: publicEndpoint.origin,
      region: options.region,
      forcePathStyle: true,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  async createUploadUrl(input: UploadUrlInput): Promise<string> {
    const url = await getSignedUrl(this.signingClient, new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ContentType: input.contentType,
      // Explicitly omit ACLs. Bucket policy controls public preview access.
    }), { expiresIn: input.expiresInSeconds ?? 900 });
    return this.addPublicPath(url);
  }

  async createMultipartUpload(input: MultipartUploadInput): Promise<{ uploadId: string }> {
    const result = await this.client.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: input.key, ContentType: input.contentType }));
    if (!result.UploadId) throw new Error('Object storage did not return a multipart upload ID');
    return { uploadId: result.UploadId };
  }

  async createPartUploadUrl(input: MultipartPartUrlInput): Promise<string> {
    const url = await getSignedUrl(this.signingClient, new UploadPartCommand({
      Bucket: this.bucket,
      Key: input.key,
      UploadId: input.uploadId,
      PartNumber: input.partNumber,
    }), { expiresIn: input.expiresInSeconds ?? 900 });
    return this.addPublicPath(url);
  }

  async listParts(key: string, uploadId: string): Promise<MultipartPart[]> {
    const parts: MultipartPart[] = [];
    let partNumberMarker: string | undefined;
    do {
      const result = await this.client.send(new ListPartsCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumberMarker: partNumberMarker }));
      for (const part of result.Parts ?? []) {
        if (part.PartNumber && part.ETag) parts.push({ partNumber: part.PartNumber, etag: part.ETag, size: Number(part.Size ?? 0) });
      }
      if (!result.IsTruncated || !result.NextPartNumberMarker) break;
      partNumberMarker = result.NextPartNumberMarker;
    } while (true);
    return parts;
  }

  async completeMultipartUpload(input: CompleteMultipartInput): Promise<void> {
    await this.client.send(new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: input.key,
      UploadId: input.uploadId,
      MultipartUpload: { Parts: input.parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })) },
    }));
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }));
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
    const url = await getSignedUrl(this.signingClient, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSeconds });
    return this.addPublicPath(url);
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

  private addPublicPath(url: string): string {
    if (!this.publicPathPrefix) return url;
    const parsed = new URL(url);
    parsed.pathname = `${this.publicPathPrefix}${parsed.pathname}`;
    return parsed.toString();
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly objects = new Map<string, StoredObject & { body: Uint8Array }>();
  private readonly multipart = new Map<string, { key: string; contentType: string; parts: Map<number, { etag: string; body: Uint8Array }> }>();

  async createUploadUrl(input: UploadUrlInput): Promise<string> { return `memory://upload/${encodeURIComponent(input.key)}`; }

  async createMultipartUpload(input: MultipartUploadInput): Promise<{ uploadId: string }> {
    const uploadId = randomUUID();
    this.multipart.set(uploadId, { key: input.key, contentType: input.contentType, parts: new Map() });
    return { uploadId };
  }

  async createPartUploadUrl(input: MultipartPartUrlInput): Promise<string> {
    if (!this.multipart.has(input.uploadId)) throw new Error('Multipart upload not found');
    return `memory://part/${encodeURIComponent(input.uploadId)}/${input.partNumber}`;
  }

  async putMultipartPart(uploadId: string, partNumber: number, body: Uint8Array): Promise<string> {
    const upload = this.multipart.get(uploadId);
    if (!upload) throw new Error('Multipart upload not found');
    const etag = `"${createHash('md5').update(body).digest('hex')}"`;
    upload.parts.set(partNumber, { etag, body: new Uint8Array(body) });
    return etag;
  }

  async listParts(key: string, uploadId: string): Promise<MultipartPart[]> {
    const upload = this.multipart.get(uploadId);
    if (!upload || upload.key !== key) return [];
    return [...upload.parts.entries()].sort(([a], [b]) => a - b).map(([partNumber, part]) => ({ partNumber, etag: part.etag, size: part.body.byteLength }));
  }

  async completeMultipartUpload(input: CompleteMultipartInput): Promise<void> {
    const upload = this.multipart.get(input.uploadId);
    if (!upload || upload.key !== input.key) throw new Error('Multipart upload not found');
    const body = input.parts.map((part) => upload.parts.get(part.partNumber)?.body).filter((part): part is Uint8Array => Boolean(part));
    if (body.length !== input.parts.length) throw new Error('Multipart part not found');
    const bytes = new Uint8Array(body.reduce((sum, part) => sum + part.byteLength, 0));
    let offset = 0;
    for (const part of body) { bytes.set(part, offset); offset += part.byteLength; }
    this.objects.set(input.key, { key: input.key, size: bytes.byteLength, contentType: upload.contentType, body: bytes });
    this.multipart.delete(input.uploadId);
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const upload = this.multipart.get(uploadId);
    if (upload?.key === key) this.multipart.delete(uploadId);
  }

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
