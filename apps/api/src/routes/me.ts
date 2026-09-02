import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { updateMeRequestSchema } from '@kingdc/contracts';
import type { ErrorCode, MeResponse } from '@kingdc/contracts';
import { AvatarInvalidError, removeAvatar, renderAvatar, writeAvatar } from '../lib/avatar.js';
import { hasErrorCode, sendError } from '../lib/errors.js';
import { USER_FOR_ME_SELECT, toMe } from '../lib/me.js';
import { propagateProfile } from '../lib/profile.js';
import { requireUser } from '../plugins/session.js';

type UploadFailure = 'missing' | 'too-large' | 'not-multipart';
type Upload = { buffer: Buffer } | { failure: UploadFailure };

const UPLOAD_FAILURES: Record<UploadFailure, { status: number; code: ErrorCode; message: string }> = {
  'too-large': { status: 413, code: 'AVATAR_TOO_LARGE', message: 'A imagem passa de 5 MB.' },
  missing: { status: 400, code: 'VALIDATION', message: 'Envie a imagem no campo "file".' },
  'not-multipart': {
    status: 400,
    code: 'VALIDATION',
    message: 'Envie a imagem como multipart/form-data, no campo "file".',
  },
};

/**
 * Lê o único arquivo do multipart. O limite de 5 MB é do `@fastify/multipart`, que corta o
 * stream e sinaliza por `FST_REQ_FILE_TOO_LARGE` ou por `truncated` (decisão D13).
 */
async function readUpload(request: FastifyRequest): Promise<Upload> {
  try {
    const part = await request.file();
    if (part === undefined) return { failure: 'missing' };
    const buffer = await part.toBuffer();
    if (part.file.truncated) return { failure: 'too-large' };
    if (part.fieldname !== 'file') return { failure: 'missing' };
    return { buffer };
  } catch (error) {
    if (hasErrorCode(error, 'FST_REQ_FILE_TOO_LARGE')) return { failure: 'too-large' };
    if (hasErrorCode(error, 'FST_INVALID_MULTIPART_CONTENT_TYPE')) {
      return { failure: 'not-multipart' };
    }
    throw error;
  }
}

/** `GET/PATCH /me` e `PUT/DELETE /me/avatar` (decisões D13, D14). */
export function registerMeRoutes(app: FastifyInstance): void {
  const auth = { preHandler: app.requireAuth };

  app.get('/me', auth, async (request): Promise<MeResponse> => toMe(requireUser(request)));

  app.patch('/me', auth, async (request, reply): Promise<MeResponse | FastifyReply> => {
    const parsed = updateMeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const message = 'Apelido precisa ter de 2 a 24 caracteres visíveis, sem caracteres de controle.';
      return sendError(reply, 400, 'VALIDATION', message);
    }
    const updated = await app.prisma.user.update({
      where: { id: requireUser(request).id },
      data: { nickname: parsed.data.nickname },
      select: USER_FOR_ME_SELECT,
    });
    const me = toMe(updated);
    await propagateProfile(app, me);
    return me;
  });

  app.put('/me/avatar', auth, async (request, reply): Promise<MeResponse | FastifyReply> => {
    const user = requireUser(request);
    const upload = await readUpload(request);

    if ('failure' in upload) {
      const { status, code, message } = UPLOAD_FAILURES[upload.failure];
      return sendError(reply, status, code, message);
    }

    let webp: Buffer;
    try {
      webp = await renderAvatar(upload.buffer);
    } catch (error) {
      if (error instanceof AvatarInvalidError) {
        return sendError(reply, 400, 'AVATAR_INVALID', 'Envie um PNG, JPG ou WebP válido.');
      }
      throw error;
    }

    await writeAvatar(app.env.AVATAR_DIR, user.id, webp);
    const updated = await app.prisma.user.update({
      where: { id: user.id },
      data: { avatarUpdatedAt: new Date() },
      select: USER_FOR_ME_SELECT,
    });
    const me = toMe(updated);
    await propagateProfile(app, me);
    return me;
  });

  app.delete('/me/avatar', auth, async (request): Promise<MeResponse> => {
    const user = requireUser(request);
    await removeAvatar(app.env.AVATAR_DIR, user.id);
    const updated = await app.prisma.user.update({
      where: { id: user.id },
      data: { avatarUpdatedAt: null },
      select: USER_FOR_ME_SELECT,
    });
    const me = toMe(updated);
    await propagateProfile(app, me);
    return me;
  });
}
