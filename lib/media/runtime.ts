import 'server-only';

import { runtimeRepository } from '@/lib/repositories';
import { GenerationService } from './generation-service';
import { MediaReviewService } from './review-service';
import { AudioGenerationService } from './audio-service';
import { CaptionService } from './caption-service';
export const generationService = new GenerationService(runtimeRepository);
export const mediaReviewService = new MediaReviewService(runtimeRepository);
export const audioGenerationService = new AudioGenerationService(runtimeRepository);
export const captionService = new CaptionService(runtimeRepository);
