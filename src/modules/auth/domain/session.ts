export type Role = 'brand' | 'influencer' | 'admin';

export interface AuthContext {
  userId: string;
  role: Role;
  profileId: string;
}

export interface SessionView {
  role: Role;
  id: string;
  name: string;
  email: string;
  contact?: string;
  plan?: string;
  handle?: string;
  avatar: {
    name: string;
    hue: number;
    photo?: string | null;
    verified?: boolean;
  };
}

export function presentBrandSession(input: {
  id: string;
  name: string;
  email: string;
  contactName: string;
  plan: string;
}): SessionView {
  return {
    role: 'brand',
    id: input.id,
    name: input.name,
    email: input.email,
    contact: input.contactName,
    plan: input.plan,
    avatar: { name: input.name, hue: 20 },
  };
}

export function presentInfluencerSession(input: {
  id: string;
  name: string;
  email: string;
  handle: string;
  hue: number;
  photoUrl: string | null;
  verified: boolean;
}): SessionView {
  return {
    role: 'influencer',
    id: input.id,
    name: input.name,
    email: input.email,
    handle: input.handle,
    avatar: {
      name: input.name,
      hue: input.hue,
      photo: input.photoUrl,
      verified: input.verified,
    },
  };
}

export function presentAdminSession(email: string): SessionView {
  return {
    role: 'admin',
    id: 'admin',
    name: 'Admin PULLUP',
    email,
    avatar: { name: 'Admin PULLUP', hue: 280 },
  };
}
