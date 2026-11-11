export interface PresentedCampaign {
  id: string;
  ref: string;
  brandId: string;
  infId: string;
  offer: { id: string; net: string; fmt: string; price: number };
  amount: number;
  fee: number;
  payout: number;
  status: string;
  createdAt: string;
  pay: string;
  brief: {
    title: string;
    objective: string;
    theme: string;
    text: string;
    link: string;
    date: string | null;
    file: string | null;
  };
  log: Array<{ s: string; at: string; n: string }>;
  perf: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
  } | null;
  proof: { url: string; note: string; at: string } | null;
  msgs: Array<{ from: string; t: string; at: string }>;
  review: { stars: number; text: string; at: string } | null;
  disputeReason: string | null;
  utm: string;
  influencer: {
    id: string;
    handle: string;
    name: string;
    hue: number;
    photo: string | null;
    verified: boolean;
  };
  brand: { id: string; name: string };
}

export interface CampaignPresentInput {
  id: string;
  ref: string;
  brandId: string;
  influencerId: string;
  offerRateId: string;
  offerNet: string;
  offerFormat: string;
  offerPrice: number;
  amountFcfa: number;
  feeFcfa: number;
  payoutFcfa: number;
  payMethod: string;
  status: string;
  createdAt: Date;
  briefTitle: string;
  briefObjective: string;
  briefTheme: string;
  briefText: string;
  briefLink: string;
  briefDate: Date | null;
  briefFileUrl: string | null;
  utmUrl: string;
  proofUrl: string | null;
  proofNote: string | null;
  proofAt: Date | null;
  perfViews: number | null;
  perfLikes: number | null;
  perfComments: number | null;
  perfShares: number | null;
  perfClicks: number | null;
  disputeReason: string | null;
  brand: { id: string; name: string };
  influencer: {
    id: string;
    handle: string;
    name: string;
    hue: number;
    photoUrl: string | null;
    verified: boolean;
  };
  events: Array<{ status: string; note: string; createdAt: Date }>;
  messages: Array<{ fromRole: string; body: string; createdAt: Date }>;
  review: { stars: number; text: string; createdAt: Date } | null;
}

export function presentCampaign(row: CampaignPresentInput): PresentedCampaign {
  return {
    id: row.id,
    ref: row.ref,
    brandId: row.brandId,
    infId: row.influencerId,
    offer: {
      id: row.offerRateId,
      net: row.offerNet,
      fmt: row.offerFormat,
      price: row.offerPrice,
    },
    amount: row.amountFcfa,
    fee: row.feeFcfa,
    payout: row.payoutFcfa,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    pay: row.payMethod,
    brief: {
      title: row.briefTitle,
      objective: row.briefObjective,
      theme: row.briefTheme,
      text: row.briefText,
      link: row.briefLink,
      date: row.briefDate ? row.briefDate.toISOString() : null,
      file: row.briefFileUrl,
    },
    log: [...row.events]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((event) => ({
        s: event.status,
        at: event.createdAt.toISOString(),
        n: event.note,
      })),
    perf:
      row.perfViews == null
        ? null
        : {
            views: row.perfViews,
            likes: row.perfLikes ?? 0,
            comments: row.perfComments ?? 0,
            shares: row.perfShares ?? 0,
            clicks: row.perfClicks ?? 0,
          },
    proof: row.proofUrl
      ? {
          url: row.proofUrl,
          note: row.proofNote ?? '',
          at: (row.proofAt ?? row.createdAt).toISOString(),
        }
      : null,
    msgs: [...row.messages]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((message) => ({
        from: message.fromRole,
        t: message.body,
        at: message.createdAt.toISOString(),
      })),
    review: row.review
      ? {
          stars: row.review.stars,
          text: row.review.text,
          at: row.review.createdAt.toISOString(),
        }
      : null,
    disputeReason: row.disputeReason,
    utm: row.utmUrl,
    influencer: {
      id: row.influencer.id,
      handle: row.influencer.handle,
      name: row.influencer.name,
      hue: row.influencer.hue,
      photo: row.influencer.photoUrl,
      verified: row.influencer.verified,
    },
    brand: { id: row.brand.id, name: row.brand.name },
  };
}
