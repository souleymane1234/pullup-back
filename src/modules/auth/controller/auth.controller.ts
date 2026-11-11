import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator.js';
import { ZodPipe } from '../../../common/http/zod.pipe.js';
import {
  demoDto,
  forgotDto,
  handleQueryDto,
  loginDto,
  resetDto,
  signupBrandDto,
  signupInfluencerDto,
  type DemoDto,
  type LoginDto,
  type SignupBrandDto,
  type SignupInfluencerDto,
} from '../dto/auth.dto.js';
import { AuthService } from '../service/auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('session')
  async session(@Req() req: Request, @Res() res: Response) {
    const userId = req.session?.userId;
    const role = req.session?.role;
    const profileId = req.session?.profileId;
    if (!userId || !role || !profileId) {
      return res.status(200).json(null);
    }
    const session = await this.auth.currentSession({ userId, role, profileId });
    return res.status(200).json(session);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body(new ZodPipe(loginDto)) dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, req);
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Req() req: Request) {
    if (!req.session?.userId) {
      return { message: 'Déconnecté.' };
    }
    return this.auth.logout(req);
  }

  @Public()
  @HttpCode(200)
  @Post('signup/brand')
  signupBrand(
    @Body(new ZodPipe(signupBrandDto)) dto: SignupBrandDto,
    @Req() req: Request,
  ) {
    return this.auth.signupBrand(dto, req);
  }

  @Public()
  @Get('handle')
  handle(@Query(new ZodPipe(handleQueryDto)) query: { handle: string }) {
    return this.auth.isHandleAvailable(query.handle);
  }

  @Public()
  @HttpCode(200)
  @Post('signup/influencer')
  signupInfluencer(
    @Body(new ZodPipe(signupInfluencerDto)) dto: SignupInfluencerDto,
    @Req() req: Request,
  ) {
    return this.auth.signupInfluencer(dto, req);
  }

  @Public()
  @HttpCode(200)
  @Post('demo')
  demo(@Body(new ZodPipe(demoDto)) dto: DemoDto, @Req() req: Request) {
    return this.auth.demo(dto, req);
  }

  @Public()
  @HttpCode(200)
  @Post('password/forgot')
  forgot(@Body(new ZodPipe(forgotDto)) dto: { email: string }) {
    return this.auth.forgot(dto.email);
  }

  @Public()
  @HttpCode(200)
  @Post('password/reset')
  reset(@Body(new ZodPipe(resetDto)) dto: { token: string; password: string }) {
    return this.auth.reset(dto.token, dto.password);
  }
}
