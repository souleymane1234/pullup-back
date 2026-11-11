import { Controller, Post } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator.js';
import { AppError } from '../../../common/http/app.error.js';

@Public()
@Controller('system')
export class SystemController {
  @Post('erreur-metier')
  fail() {
    throw new AppError('Cette action de test est volontairement refusée.', 422);
  }
}
