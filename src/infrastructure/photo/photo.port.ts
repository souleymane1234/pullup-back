/** Upload S3 (module 03) ou data URL si le bucket n’est pas configuré. */
export interface PhotoPort {
  saveSignupPhoto(dataUrl: string | null | undefined): Promise<string | null>;
  saveProfilePhoto(dataUrl: string): Promise<string>;
  deletePhoto(url: string | null | undefined): Promise<void>;
}

export const PHOTO = Symbol('PHOTO');
