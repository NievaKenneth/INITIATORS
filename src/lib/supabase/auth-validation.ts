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

export function normalizeFullName(rawFullName: unknown): string | null {
  const fullName =
    typeof rawFullName === "string"
      ? rawFullName.normalize("NFC").trim().replace(/\s+/g, " ")
      : "";

  if (
    fullName.length < 2 ||
    fullName.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(fullName)
  ) {
    return null;
  }

  return fullName;
}

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

export function validateLoginCredentialsInput(
  rawEmail: unknown,
  rawPassword: unknown,
): CredentialsValidation {
  const emailValidation = validateEmail(rawEmail);
  const password =
    typeof rawPassword === "string" ? rawPassword : "";
  const fieldErrors: Partial<Record<AuthField, string>> = {};

  if (!emailValidation.success) {
    fieldErrors.email = emailValidation.message;
  }

  if (password.length === 0) {
    fieldErrors.password = "Password is required.";
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    fieldErrors.password = "Password must be 128 characters or fewer.";
  }

  if (
    !emailValidation.success ||
    password.length === 0 ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    credentials: {
      email: emailValidation.email,
      password,
    },
  };
}

export function validateCredentials(formData: FormData): CredentialsValidation {
  return validateCredentialsInput(
    formData.get("email"),
    formData.get("password"),
  );
}

export function validateLoginCredentials(
  formData: FormData,
): CredentialsValidation {
  return validateLoginCredentialsInput(
    formData.get("email"),
    formData.get("password"),
  );
}
