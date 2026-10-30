import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";

export interface PrivateStorage {
  put(key: string, contentType: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
class LocalPrivateStorage implements PrivateStorage {
  private readonly root = path.resolve(config.localStorageDir);
  private resolveKey(key: string) {
    const fullPath = path.resolve(this.root, key);
    if (!fullPath.startsWith(this.root + path.sep)) throw new Error("Invalid private storage key.");
    return fullPath;
  }
  async put(key: string, _contentType: string, bytes: Buffer) {
    const fullPath = this.resolveKey(key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, bytes, { flag: "wx" });
  }
  async get(key: string) { return readFile(this.resolveKey(key)); }
  async remove(key: string) { await rm(this.resolveKey(key), { force: true }); }
}
class S3PrivateStorage implements PrivateStorage {
  private readonly bucket = config.s3Bucket;
  private readonly client = new S3Client({
    region: config.s3Region ?? "us-east-1",
    ...(config.s3Endpoint ? { endpoint: config.s3Endpoint, forcePathStyle: true } : {}),
    ...(config.s3AccessKeyId && config.s3SecretAccessKey
      ? { credentials: { accessKeyId: config.s3AccessKeyId, secretAccessKey: config.s3SecretAccessKey } }
      : {}),
  });
  constructor() {
    if (!this.bucket) throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3.");
  }
  async put(key: string, contentType: string, bytes: Buffer) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: key, Body: bytes, ContentType: contentType, ServerSideEncryption: "AES256",
    }));
  }
  async get(key: string) {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error("Resume object was empty.");
    return Buffer.from(await result.Body.transformToByteArray());
  }
  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
export const privateStorage: PrivateStorage = config.storageDriver === "s3"
  ? new S3PrivateStorage()
  : new LocalPrivateStorage();
export function newStorageKey(extension: "pdf" | "docx") {
  return "resumes/" + randomUUID() + "." + extension;
}
export function newAvatarStorageKey(extension: "jpg" | "png" | "webp") {
  return "avatars/" + randomUUID() + "." + extension;
}
