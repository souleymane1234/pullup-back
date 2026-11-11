import { SetMetadata } from '@nestjs/common';
import type { FlagKey } from '../../modules/platform/domain/flags.js';

export const REQUIRE_FLAG = 'requireFlag';
export const RequireFlag = (key: FlagKey) => SetMetadata(REQUIRE_FLAG, key);
