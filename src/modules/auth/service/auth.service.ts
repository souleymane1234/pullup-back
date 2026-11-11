import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { AppError } from '../../../common/http/app.error.js';
import {
  hashPassword,
  verifyPassword,
} from '../../../common/security/password.js';
import { EnvService } from '../../../config/env.service.js';
import { MAIL, type MailPort } from '../../../infrastructure/mail/mail.port.js';
import {
  PHOTO,
  type PhotoPort,
} from '../../../infrastructure/photo/photo.port.js';
import { NOTIFY, type NotifyPort } from '../../../common/notify.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../../audit/service/audit.service.js';
import { firstName, normalizeEmail } from '../domain/email.js';
import { normalizeHandle } from '../domain/handle.js';
import type { AuthContext, SessionView } from '../domain/session.js';
import {
  presentAdminSession,
  presentBrandSession,
  presentInfluencerSession,
} from '../domain/session.js';
import { derivedOf } from '../../influencers/domain/metrics.js';
import {
  DEFAULT_BIO,
  emptyAudience,
  buildRates,
  randomHue,
  selectedCats,
  selectedNets,
} from '../domain/signup.js';
import type {
  DemoDto,
  LoginDto,
  SignupBrandDto,
  SignupInfluencerDto,
} from '../dto/auth.dto.js';
import { BrandsRepository } from '../repository/brands.repository.js';
import { InfluencersRepository } from '../repository/influencers.repository.js';
import { PasswordResetsRepository } from '../repository/password-resets.repository.js';
import { SessionsRepository } from '../repository/sessions.repository.js';
import { UsersRepository } from '../repository/users.repository.js';
import { LoginThrottleService } from './login-throttle.service.js';

const WRONG = 'Identifiants incorrects.';
const EMAIL_TAKEN = 'Un compte existe déjà avec cet e-mail.';
const HANDLE_TAKEN = "Ce nom d'utilisateur est déjà pris.";
const FORGOT = "Si un compte existe, un e-mail vient d'être envoyé.";

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly brands: BrandsRepository,
    private readonly influencers: InfluencersRepository,
    private readonly sessions: SessionsRepository,
    private readonly resets: PasswordResetsRepository,
    private readonly throttle: LoginThrottleService,
    private readonly env: EnvService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    @Inject(NOTIFY) private readonly notify: NotifyPort,
    @Inject(MAIL) private readonly mail: MailPort,
    @Inject(PHOTO) private readonly photos: PhotoPort,
  ) {}

  async currentSession(
    auth: AuthContext | undefined,
  ): Promise<SessionView | null> {
    if (!auth) {
      return null;
    }
    return this.sessionOf(auth);
  }

  async login(
    dto: LoginDto,
    req: Request,
  ): Promise<{ session: SessionView; message: string }> {
    const email = normalizeEmail(dto.email);
    const ip = req.ip ?? 'unknown';
    await this.throttle.assertAllowed(ip, email);
    const user = await this.users.findByEmail(email);
    const valid = user
      ? await verifyPassword(dto.password, user.passwordHash)
      : false;
    if (!user || !valid) {
      await this.throttle.recordFailure(ip, email);
      throw new AppError(WRONG, 401);
    }
    await this.throttle.clear(ip, email);
    const session = await this.openSession(req, user);
    await this.audit.record({
      actorUserId: user.id,
      action: 'login',
      targetType: 'User',
      targetId: user.id,
      ip,
    });
    return { session, message: `Connecté : ${session.name}` };
  }

  async logout(req: Request): Promise<{ message: string }> {
    if (req.session.id) {
      await this.sessions.deleteById(req.session.id);
    }
    await this.destroyCookie(req);
    return { message: 'Déconnecté.' };
  }

  async signupBrand(dto: SignupBrandDto, req: Request) {
    const email = normalizeEmail(dto.email);
    if (await this.users.findByEmail(email)) {
      throw new AppError(EMAIL_TAKEN, 409);
    }
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword(dto.password),
          role: 'brand',
          brand: {
            create: {
              name: dto.company.trim(),
              contactName: dto.contact.trim(),
              sector: '',
              plan: 'free',
              balanceFcfa: 0,
            },
          },
        },
        include: { brand: true, influencer: true },
      });
      const session = await this.openSession(req, user);
      await this.audit.record({
        actorUserId: user.id,
        action: 'signup_brand',
        targetType: 'Brand',
        targetId: user.brand!.id,
        ip: req.ip,
      });
      return {
        session,
        message: `Bienvenue sur PULLUP, ${firstName(dto.contact)} !`,
      };
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async isHandleAvailable(raw: string): Promise<{ available: boolean }> {
    const handle = normalizeHandle(raw);
    if (!handle) {
      return { available: false };
    }
    return { available: !(await this.influencers.findByHandle(handle)) };
  }

  async signupInfluencer(dto: SignupInfluencerDto, req: Request) {
    const email = normalizeEmail(dto.email);
    const handle = normalizeHandle(dto.handle);
    if (!handle) {
      throw new AppError("Nom d'utilisateur requis.", 400);
    }
    if (await this.users.findByEmail(email)) {
      throw new AppError(EMAIL_TAKEN, 409);
    }
    if (await this.influencers.findByHandle(handle)) {
      throw new AppError(HANDLE_TAKEN, 409);
    }
    const nets = selectedNets(dto.nets);
    const cats = selectedCats(dto.cats);
    const firstNet = nets[0]![0];
    const rates = buildRates(firstNet, dto.price, dto.accepts.dedicace).map(
      (rate, index) => ({
        id: `r${index}`,
        ...rate,
      }),
    );
    const netMap = Object.fromEntries(
      nets.map(([key, count]) => [key, [count, 0] as [number, number]]),
    );
    const derived = derivedOf({
      net: netMap,
      rates,
      auth: 0,
      creat: 0,
      brief: 0,
      onTime: 0,
      verified: false,
      status: 'pending',
    });
    const photoUrl = await this.photos.saveSignupPhoto(dto.photo);
    const city = dto.city.trim();
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword(dto.password),
          role: 'influencer',
          influencer: {
            create: {
              handle,
              name: dto.name.trim(),
              phone: dto.phone.trim(),
              city,
              bio: DEFAULT_BIO,
              bioDraft: dto.bio.trim() || null,
              hue: randomHue(),
              photoUrl,
              verified: false,
              certified: false,
              status: 'pending',
              acceptsPub: dto.accepts.pub,
              acceptsPartenariat: dto.accepts.partenariat,
              acceptsDedicace: dto.accepts.dedicace,
              nets: netMap,
              cats,
              audience: emptyAudience(),
              scoreAuth: 0,
              scoreCreat: 0,
              scoreBrief: 0,
              scoreOnTime: 0,
              days: ['Lun', 'Mer', 'Ven'],
              rates,
              totalFollowers: derived.totalFollowers,
              avgEngagement: derived.avgEngagement,
              minPrice: derived.minPrice,
              badgeKey: derived.badgeKey,
              pullupScore: derived.pullupScore,
            },
          },
        },
        include: { brand: true, influencer: true },
      });
      await this.notify.notify(
        'admin',
        `Nouvelle inscription à vérifier : ${dto.name.trim()}.`,
        '/admin?tab=verif',
      );
      const session = await this.openSession(req, user);
      await this.audit.record({
        actorUserId: user.id,
        action: 'signup_influencer',
        targetType: 'Influencer',
        targetId: user.influencer!.id,
        ip: req.ip,
      });
      return { session, message: 'Vitrine créée ! Vérification sous 48 h.' };
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async demo(dto: DemoDto, req: Request) {
    if (!this.env.get('DEMO_MODE')) {
      throw new AppError('Introuvable.', 404);
    }
    const user = await this.findDemoUser(dto.role, dto.id);
    if (!user) {
      throw new AppError('Compte de démonstration introuvable.', 404);
    }
    const session = await this.openSession(req, user);
    return { session, message: `Connecté : ${session.name}` };
  }

  async forgot(emailRaw: string): Promise<{ message: string }> {
    const email = normalizeEmail(emailRaw);
    const user = await this.users.findByEmail(email);
    if (user) {
      const token = randomBytes(32).toString('hex');
      await this.resets.create({
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      const origin = this.env.get('FRONT_ORIGIN');
      await this.mail.send(
        user.email,
        'Réinitialisation de votre mot de passe PULLUP',
        `Ouvrez ce lien pour choisir un nouveau mot de passe : ${origin}/mot-de-passe?token=${token}`,
      );
    }
    return { message: FORGOT };
  }

  async reset(token: string, password: string): Promise<{ message: string }> {
    const row = await this.resets.findValid(this.hashToken(token));
    if (!row || row.user.deletedAt) {
      throw new AppError('Ce lien n’est plus valable.', 400);
    }
    await this.users.updatePassword(row.userId, await hashPassword(password));
    await this.resets.markUsed(row.id);
    await this.sessions.deleteByUser(row.userId);
    return { message: 'Mot de passe modifié.' };
  }

  async exportMe(auth: AuthContext) {
    const user = await this.users.findById(auth.userId);
    if (!user) {
      throw new AppError('Connectez-vous pour continuer.', 401);
    }
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      brand: user.brand
        ? {
            id: user.brand.id,
            name: user.brand.name,
            contact: user.brand.contactName,
            plan: user.brand.plan,
            sector: user.brand.sector,
          }
        : null,
      influencer: user.influencer
        ? {
            id: user.influencer.id,
            handle: user.influencer.handle,
            name: user.influencer.name,
            phone: user.influencer.phone,
            city: user.influencer.city,
          }
        : null,
    };
  }

  async deleteMe(auth: AuthContext, password: string, req: Request) {
    const user = await this.users.findById(auth.userId);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError(WRONG, 401);
    }
    const email = `deleted.${user.id}@pullup.invalid`;
    await this.users.anonymize(
      user.id,
      email,
      await hashPassword(randomBytes(16).toString('hex')),
    );
    if (user.brand) {
      await this.brands.anonymize(user.brand.id);
    }
    if (user.influencer) {
      await this.influencers.anonymize(
        user.influencer.id,
        `deleted.${user.id}`,
      );
    }
    await this.sessions.deleteByUser(user.id);
    await this.destroyCookie(req);
    await this.audit.record({
      actorUserId: user.id,
      action: 'delete_account',
      targetType: 'User',
      targetId: user.id,
      ip: req.ip,
    });
    return { message: 'Compte supprimé.' };
  }

  private async findDemoUser(role: DemoDto['role'], id: string) {
    if (role === 'admin') {
      return this.users.findByEmail('admin@pullup.net');
    }
    if (role === 'brand') {
      const brand = await this.brands.findById(id);
      return brand && !brand.user.deletedAt
        ? this.users.findById(brand.userId)
        : null;
    }
    const influencer = await this.influencers.findById(id);
    return influencer && !influencer.user.deletedAt
      ? this.users.findById(influencer.userId)
      : null;
  }

  private async openSession(
    req: Request,
    user: {
      id: string;
      email: string;
      role: AuthContext['role'];
      brand: {
        id: string;
        name: string;
        contactName: string;
        plan: string;
      } | null;
      influencer: {
        id: string;
        name: string;
        handle: string;
        hue: number;
        photoUrl: string | null;
        verified: boolean;
      } | null;
    },
  ): Promise<SessionView> {
    const profileId =
      user.role === 'admin'
        ? 'admin'
        : user.role === 'brand'
          ? user.brand!.id
          : user.influencer!.id;
    await this.regenerate(req);
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.profileId = profileId;
    await this.saveCookie(req);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.sessions.create({
      id: req.session.id,
      userId: user.id,
      expiresAt,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
    await this.users.touchLogin(user.id);
    return this.present(user);
  }

  private present(user: {
    email: string;
    role: AuthContext['role'];
    brand: {
      id: string;
      name: string;
      contactName: string;
      plan: string;
    } | null;
    influencer: {
      id: string;
      name: string;
      handle: string;
      hue: number;
      photoUrl: string | null;
      verified: boolean;
    } | null;
  }): SessionView {
    if (user.role === 'admin') {
      return presentAdminSession(user.email);
    }
    if (user.role === 'brand' && user.brand) {
      return presentBrandSession({ ...user.brand, email: user.email });
    }
    if (user.role === 'influencer' && user.influencer) {
      return presentInfluencerSession({
        ...user.influencer,
        email: user.email,
      });
    }
    throw new AppError('Profil introuvable.', 404);
  }

  private async sessionOf(auth: AuthContext): Promise<SessionView | null> {
    const user = await this.users.findById(auth.userId);
    if (!user) {
      return null;
    }
    return this.present(user);
  }

  private rethrowConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = String(error.meta?.target ?? '');
      if (target.includes('handle')) {
        throw new AppError(HANDLE_TAKEN, 409);
      }
      throw new AppError(EMAIL_TAKEN, 409);
    }
    throw error;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private regenerate(req: Request) {
    return new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
  }

  private saveCookie(req: Request) {
    return new Promise<void>((resolve, reject) => {
      req.session.save((error) => (error ? reject(error) : resolve()));
    });
  }

  private destroyCookie(req: Request) {
    return new Promise<void>((resolve, reject) => {
      req.session.destroy((error) => (error ? reject(error) : resolve()));
    });
  }
}
