import { AppError } from '../../../common/http/app.error.js';
import { inspectPhoto } from './photo.js';

describe('photo', () => {
  it('rejette un faux PNG', () => {
    const fake = `data:image/png;base64,${Buffer.from('not-a-png').toString('base64')}`;
    expect(() => inspectPhoto(fake)).toThrow(AppError);
    expect(() => inspectPhoto(fake)).toThrow(/invalide/);
  });

  it('rejette une photo trop lourde', () => {
    const heavy = `data:image/jpeg;base64,${Buffer.alloc(2 * 1024 * 1024 + 20, 0xff).toString('base64')}`;
    expect(() => inspectPhoto(heavy)).toThrow(/2 Mo/);
  });

  it('accepte un JPEG réel (magic bytes)', () => {
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
    ]);
    const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    expect(inspectPhoto(dataUrl).kind).toBe('jpeg');
  });
});
