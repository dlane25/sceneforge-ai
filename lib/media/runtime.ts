import { runtimeRepository } from '@/lib/repositories';
import { GenerationService } from './generation-service';
import { MediaReviewService } from './review-service';
export const generationService = new GenerationService(runtimeRepository);
export const mediaReviewService = new MediaReviewService(runtimeRepository);
