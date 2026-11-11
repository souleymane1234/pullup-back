import { Injectable } from '@nestjs/common';
import {
  campaignSequenceName,
  formatCampaignRef,
} from '../domain/reference.js';
import { ReferencesRepository } from '../repository/references.repository.js';

@Injectable()
export class ReferencesService {
  constructor(private readonly refs: ReferencesRepository) {}

  async nextCampaignRef(at: Date = new Date()): Promise<string> {
    const value = await this.refs.nextValue(campaignSequenceName(at));
    return formatCampaignRef(at, value);
  }
}
