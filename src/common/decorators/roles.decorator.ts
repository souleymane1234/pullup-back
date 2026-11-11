import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../modules/auth/domain/session.js';

export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
