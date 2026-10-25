import { supabase } from "./supabase.js";

export function appUser(user) {
  return user
    ? {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.display_name || user.email,
      }
    : null;
}

export function createAuthService(client) {
  return {
    async currentUser() {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) return null;
      const { data, error } = await client.auth.getUser();
      if (error) {
        if ([401, 403].includes(error.status)) {
          await client.auth.signOut({ scope: "local" });
          return null;
        }
        throw error;
      }
      return appUser(data.user);
    },
    async login(email, password) {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.session)
        throw new Error("Sign-in did not create a session. Please try again.");
      return appUser(data.user);
    },
    async register(name, email, password) {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() } },
      });
      if (error) throw error;
      if (!data.session)
        throw new Error(
          "Email confirmation is still enabled in Supabase. Switch off Confirm email, then sign in.",
        );
      return appUser(data.user);
    },
    async logout() {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
    },
  };
}

export const auth = createAuthService(supabase);
