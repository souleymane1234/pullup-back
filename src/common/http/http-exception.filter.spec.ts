import { ArgumentsHost, HttpException } from '@nestjs/common';
import { AppError } from './app.error.js';
import { HttpExceptionFilter } from './http-exception.filter.js';

function hostWith(response: {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  it('renvoie { message } pour une erreur métier', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    new HttpExceptionFilter().catch(
      new AppError('Tarif trop bas.', 422),
      hostWith({ status, json }),
    );
    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({ message: 'Tarif trop bas.' });
  });

  it('masque une erreur inattendue', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    new HttpExceptionFilter().catch(
      new Error('ECONNREFUSED 127.0.0.1'),
      hostWith({ status, json }),
    );
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      message: 'Le service est indisponible.',
    });
  });

  it('conserve le statut d’une HttpException Nest', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    new HttpExceptionFilter().catch(
      new HttpException({ message: 'Trop de tentatives.' }, 429),
      hostWith({ status, json }),
    );
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ message: 'Trop de tentatives.' });
  });
});
