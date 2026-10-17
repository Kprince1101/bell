import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { z } from 'zod';
import { GENERIC_ERROR_MESSAGE } from '@/lib/constants';
import { ApiError } from '@/lib/errors';
import { isOwner } from '@/lib/invites';
import { createClient } from '@/lib/supabase/server';
import type { BellClient } from '@/lib/supabase/server';

export interface AuthedContext {
  supabase: BellClient;
  user: User;
}

export const requireUser = async (): Promise<AuthedContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new ApiError('Unauthorized', 401);
  return { supabase, user };
};

export const requireOwner = async (): Promise<AuthedContext> => {
  const context = await requireUser();
  if (!(await isOwner(context.supabase))) {
    throw new ApiError('Forbidden', 403);
  }
  return context;
};

const INVALID_REQUEST = 'Invalid request';

const invalidMessage = (error: z.ZodError, explain: boolean): string => {
  if (!explain) return INVALID_REQUEST;
  return error.issues[0]?.message ?? INVALID_REQUEST;
};

export const parseBody = async <Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
  { explain = false }: { explain?: boolean } = {},
): Promise<z.infer<Schema>> => {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(invalidMessage(parsed.error, explain), 400);
  }
  return parsed.data;
};

export const withRouteErrors =
  <TArgs extends unknown[]>(handler: (...args: TArgs) => Promise<Response>) =>
  async (...args: TArgs): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: err.message },
          { status: err.status },
        );
      }
      console.error(err);
      return NextResponse.json(
        { error: GENERIC_ERROR_MESSAGE },
        { status: 500 },
      );
    }
  };
