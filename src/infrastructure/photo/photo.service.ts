import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { EnvService } from '../../config/env.service.js';
import { inspectPhoto } from '../../modules/influencers/domain/photo.js';
import type { PhotoPort } from './photo.port.js';

@Injectable()
export class PhotoService implements PhotoPort {
  private readonly s3: S3Client | null;

  constructor(private readonly env: EnvService) {
    this.s3 = this.enabled()
      ? new S3Client({
          region: 'auto',
          endpoint: this.env.get('S3_ENDPOINT') || undefined,
          forcePathStyle: Boolean(this.env.get('S3_ENDPOINT')),
          credentials: {
            accessKeyId: this.env.get('S3_ACCESS_KEY'),
            secretAccessKey: this.env.get('S3_SECRET_KEY'),
          },
        })
      : null;
  }

  async saveSignupPhoto(
    dataUrl: string | null | undefined,
  ): Promise<string | null> {
    if (!dataUrl) {
      return null;
    }
    try {
      return await this.saveProfilePhoto(dataUrl);
    } catch {
      return null;
    }
  }

  async saveProfilePhoto(dataUrl: string): Promise<string> {
    const { bytes } = inspectPhoto(dataUrl);
    const webp = await sharp(bytes)
      .rotate()
      .resize(800, 800, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
    if (!this.s3) {
      return `data:image/webp;base64,${webp.toString('base64')}`;
    }
    const key = `photos/${randomBytes(16).toString('hex')}.webp`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.env.get('S3_BUCKET'),
        Key: key,
        Body: webp,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    const base = this.env.get('S3_PUBLIC_URL').replace(/\/$/, '');
    return base ? `${base}/${key}` : key;
  }

  async deletePhoto(url: string | null | undefined): Promise<void> {
    if (!url || !this.s3 || url.startsWith('data:')) {
      return;
    }
    const publicBase = this.env.get('S3_PUBLIC_URL').replace(/\/$/, '');
    const key =
      publicBase && url.startsWith(`${publicBase}/`)
        ? url.slice(publicBase.length + 1)
        : url.replace(/^https?:\/\/[^/]+\//, '');
    if (!key.startsWith('photos/')) {
      return;
    }
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.env.get('S3_BUCKET'), Key: key }),
    );
  }

  private enabled(): boolean {
    return Boolean(
      this.env.get('S3_BUCKET') &&
      this.env.get('S3_ACCESS_KEY') &&
      this.env.get('S3_SECRET_KEY'),
    );
  }
}
