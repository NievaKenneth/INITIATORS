"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import {
  validateCredentials,
  type AuthField,
} from "@/lib/supabase/auth-validation";

export type AuthActionState =
  | { success: true; message: string }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<AuthField, string>>;
    };

type PreviousAuthActionState = AuthActionState | null;

const unavailableMessage =
  "Authentication is temporarily unavailable. Please try again later.";

function getValidatedCredentials(formData: FormData) {
  const validation = validateCredentials(formData);

  if (!validation.success) {
    return {
      state: {
        success: false,
        message: "Check the highlighted fields and try again.",
        fieldErrors: validation.fieldErrors,
      } satisfies AuthActionState,
    };
  }

  return { credentials: validation.credentials };
}

export async function register(
  _previousState: PreviousAuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validated = getValidatedCredentials(formData);
  if (validated.state) {
    return validated.state;
  }

  if (!getSupabasePublicConfig()) {
    return { success: false, message: unavailableMessage };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp(validated.credentials);

    if (error) {
      return {
        success: false,
        message:
          "Unable to create an account with those details. If you already registered, try signing in.",
      };
    }

    return {
      success: true,
      message: data.session
        ? "Your account has been created."
        : "Check your email for a confirmation link to finish creating your account.",
    };
  } catch {
    console.error("Supabase registration request failed.");
    return { success: false, message: unavailableMessage };
  }
}

export async function login(
  _previousState: PreviousAuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validated = getValidatedCredentials(formData);
  if (validated.state) {
    return validated.state;
  }

  if (!getSupabasePublicConfig()) {
    return { success: false, message: unavailableMessage };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(
      validated.credentials,
    );

    if (error) {
      return {
        success: false,
        message: "Invalid email or password.",
      };
    }

    return { success: true, message: "You are signed in." };
  } catch {
    console.error("Supabase sign-in request failed.");
    return { success: false, message: unavailableMessage };
  }
}

export async function logout(): Promise<AuthActionState> {
  if (!getSupabasePublicConfig()) {
    return { success: false, message: unavailableMessage };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      console.error("Supabase sign-out returned an error.");
      return {
        success: false,
        message: "Unable to sign out. Please try again.",
      };
    }
  } catch {
    console.error("Supabase sign-out request failed.");
    return {
      success: false,
      message: "Unable to sign out. Please try again.",
    };
  }

  redirect("/");
}
