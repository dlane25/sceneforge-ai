import 'server-only';

import { runtimeRepository } from '@/lib/repositories';
import { MediaPreviewService } from './media-preview-service';

export const mediaPreviewService = new MediaPreviewService(runtimeRepository);
