import { supabase } from "./lib/supabase.js";

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Supabase error:", error.message);
    return;
  }

  console.log("Supabase connected successfully:", data);
}