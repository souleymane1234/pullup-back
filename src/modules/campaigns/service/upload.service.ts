import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'node:crypto';
import { MAX_FILE_SIZE } from '../../../common/catalog.js';
import { AppError } from '../../../common/http/app.error.js';
import { EnvService } from '../../../config/env.service.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import type { AuthContext } from '../../auth/domain/session.js';
import type { BriefUploadDto } from '../dto/campaigns.dto.js';

const PRESIGN_SECONDS = 10 * 60;

@Injectable()
export class UploadService {
  private readonly s3: S3Client | null;

  constructor(
    private readonly db: PrismaService,
    private readonly env: EnvService,
  ) {
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

  async presignBrief(auth: AuthContext, dto: BriefUploadDto) {
    if (dto.size > MAX_FILE_SIZE) {
      throw new AppError('Fichier trop lourd : 9 Mo maximum.', 422);
    }
    const filename =
      dto.filename.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'brief';
    const key = `briefs/${auth.userId}/${randomBytes(8).toString('hex')}/${filename}`;
    const fileUrl = this.publicUrl(key);
    const uploadUrl = this.s3
      ? await getSignedUrl(
          this.s3,
          new PutObjectCommand({
            Bucket: this.env.get('S3_BUCKET'),
            Key: key,
            ContentType: dto.mime,
            ContentLength: dto.size,
          }),
          { expiresIn: PRESIGN_SECONDS },
        )
      : fileUrl;
    await this.db.upload.create({
      data: {
        ownerUserId: auth.userId,
        key,
        mime: dto.mime,
        size: dto.size,
        purpose: 'brief',
        fileUrl,
      },
    });
    return { uploadUrl, fileUrl };
  }

  private publicUrl(key: string): string {
    const base = (
      this.env.get('S3_PUBLIC_URL') || 'https://cdn.pullup.local'
    ).replace(/\/$/, '');
    return `${base}/${key}`;
  }

  private enabled(): boolean {
    return Boolean(
      this.env.get('S3_BUCKET') &&
      this.env.get('S3_ACCESS_KEY') &&
      this.env.get('S3_SECRET_KEY'),
    );
  }
}
