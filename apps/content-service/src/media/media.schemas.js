import { z } from 'zod';
import { MediaKind } from './media.constants.js';

export const mediaUploadInputSchema = z.object({
  kind: z.enum(Object.values(MediaKind)),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(128),
  sizeBytes: z.number().int().positive(),
  data: z.instanceof(Uint8Array)
}).strict();

export const mediaObjectSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(Object.values(MediaKind)),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  url: z.string().url(),
  storage: z.enum(['local', 'imagekit'])
});
