export type AuthField = "email" | "password";

export type Credentials = {
  email: string;
  password: string;
};

export type CredentialsValidation =
  | { success: true; credentials: Credentials }
  | {
      success: false;
      fieldErrors: Partial<Record<AuthField, string>>;
    };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

export function validateEmail(rawEmail: unknown):
  | { success: true; email: string }
  | { success: false; message: string } {
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (!email) {
    return { success: false, message: "Email is required." };
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { success: false, message: "Enter a valid email address." };
  }

  return { success: true, email };
}

export function validatePassword(rawPassword: unknown):
  | { success: true; password: string }
  | { success: false; message: string } {
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (password.length === 0) {
    return { success: false, message: "Password is required." };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      success: false,
      message: "Password must be at least 12 characters.",
    };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      success: false,
      message: "Password must be 128 characters or fewer.",
    };
  }

  return { success: true, password };
}

export function validateCredentialsInput(
  rawEmail: unknown,
  rawPassword: unknown,
): CredentialsValidation {
  const emailValidation = validateEmail(rawEmail);
  const passwordValidation = validatePassword(rawPassword);
  const fieldErrors: Partial<Record<AuthField, string>> = {};

  if (!emailValidation.success) {
    fieldErrors.email = emailValidation.message;
  }

  if (!passwordValidation.success) {
    fieldErrors.password = passwordValidation.message;
  }

  if (!emailValidation.success || !passwordValidation.success) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    credentials: {
      email: emailValidation.email,
      password: passwordValidation.password,
    },
  };
}

export function validateCredentials(formData: FormData): CredentialsValidation {
  return validateCredentialsInput(
    formData.get("email"),
    formData.get("password"),
  );
}
