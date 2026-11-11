import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Request, Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator.js';

function docsFile(name: string) {
  return readFileSync(join(process.cwd(), 'docs', name), 'utf8');
}

@Public()
@Controller('docs')
export class DocsController {
  @Get()
  ui(@Req() req: Request, @Res() res: Response) {
    const wantsJson =
      req.accepts(['html', 'json']) === 'json' && !req.accepts('html');
    if (wantsJson || req.query.format === 'json') {
      res.type('application/json; charset=utf-8');
      return res.status(200).json(JSON.parse(docsFile('openapi.json')));
    }
    res.type('text/html; charset=utf-8');
    return res.status(200).send(docsFile('swagger.html'));
  }

  @Get('openapi.json')
  @Header('Content-Type', 'application/json; charset=utf-8')
  spec() {
    return JSON.parse(docsFile('openapi.json')) as Record<string, unknown>;
  }

  @Get('swagger-init.js')
  init(@Res() res: Response) {
    res.type('application/javascript; charset=utf-8');
    return res.status(200).send(docsFile('swagger-init.js'));
  }
}
