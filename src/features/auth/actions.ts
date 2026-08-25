"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homePathFor } from "@/services/auth.service";
import { loginSchema } from "@/validations/auth";
import type { ActionState } from "@/types";

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return { status: "error", message: "INVALID_CREDENTIALS" };
  }

  // Resolve role to land the user on the right dashboard.
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const nextParam = String(formData.get("next") ?? "");
  const target =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : homePathFor(profile?.role ?? "student");

  redirect(target);
}
