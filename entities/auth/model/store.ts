import { createEffect, createEvent, createStore } from "effector";
import { createClient } from "@/shared/lib/supabase/client";

export type AuthUser = { id: string; email: string };

export const setUser = createEvent<AuthUser | null>();

export const loginFx = createEffect(async ( creds: { email: string; password: string }) => {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword(creds);
  if (error) throw error;
  return { id: data.user!.id, email: data.user!.email! } satisfies AuthUser;
});

export const logoutFx = createEffect(async () => {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
});

export const $user = createStore<AuthUser | null>(null)
  .on(setUser, (_, v) => v)
  .on(loginFx.doneData, (_, v) => v)
  .on(logoutFx.done, () => null);

export const $authError = createStore<string | null>(null)
  .on(loginFx.failData, (_, e) => e.message)
  .on(loginFx, () => null);
