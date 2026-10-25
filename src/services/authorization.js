import { supabase } from "./supabase.js";
export async function isAdmin() {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw new Error(error.message);
  return data === true;
}
