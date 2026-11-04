import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const target = new URL(supabaseUrl);
if (
  target.protocol !== "http:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
) {
  throw new Error(
    "Test account seeding is restricted to a local Supabase URL (http://localhost, http://127.0.0.1, or http://[::1]).",
  );
}

const accountSpecs = [
  {
    role: "user",
    email: process.env.SUPABASE_TEST_USER_EMAIL,
    password: process.env.SUPABASE_TEST_USER_PASSWORD,
    fullName: "Hope Test User",
  },
  {
    role: "admin",
    email: process.env.SUPABASE_TEST_ADMIN_EMAIL,
    password: process.env.SUPABASE_TEST_ADMIN_PASSWORD,
    fullName: "Hope Test Admin",
  },
  {
    role: "superadmin",
    email: process.env.SUPABASE_TEST_SUPERADMIN_EMAIL,
    password: process.env.SUPABASE_TEST_SUPERADMIN_PASSWORD,
    fullName: "Hope Test Superadmin",
  },
];

for (const account of accountSpecs) {
  if (
    !account.email?.trim() ||
    !account.password ||
    account.password.length < 12 ||
    account.password.length > 128
  ) {
    throw new Error(
      `Set the ${account.role} test email and a 12-128 character password in environment variables.`,
    );
  }
}

const normalizedEmails = accountSpecs.map((account) =>
  account.email.trim().toLowerCase(),
);
if (new Set(normalizedEmails).size !== accountSpecs.length) {
  throw new Error("Each test role must use a different email address.");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const { data: profileProbe, error: profileProbeError } = await adminClient
  .from("profiles")
  .select("id")
  .eq("role", "superadmin")
  .limit(1);

if (profileProbeError) {
  throw new Error(
    `Cannot read public.profiles. Apply the existing profile migration first. ${profileProbeError.message}`,
  );
}

if (profileProbe.length > 0) {
  throw new Error(
    "A superadmin already exists in this local database. The script will not change existing accounts.",
  );
}

const existingEmails = new Set();
for (let page = 1; ; page += 1) {
  const { data, error } = await adminClient.auth.admin.listUsers({
    page,
    perPage: 1000,
  });

  if (error) {
    throw new Error(`Unable to inspect local Auth accounts: ${error.message}`);
  }

  for (const user of data.users) {
    if (user.email) {
      existingEmails.add(user.email.toLowerCase());
    }
  }

  if (data.users.length < 1000) {
    break;
  }
}

const conflictingEmail = normalizedEmails.find((email) =>
  existingEmails.has(email),
);
if (conflictingEmail) {
  throw new Error(
    "At least one configured test email already exists. The script will not promote or modify existing accounts.",
  );
}

const createdAccounts = [];
for (const account of accountSpecs) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: account.email.trim(),
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: account.fullName },
  });

  if (error || !data.user) {
    throw new Error(
      `Unable to create the local ${account.role} account${error ? `: ${error.message}` : "."}`,
    );
  }

  createdAccounts.push({ ...account, id: data.user.id });
}

const superadmin = createdAccounts.find(
  (account) => account.role === "superadmin",
);
const { data: bootstrapped, error: bootstrapError } = await adminClient
  .from("profiles")
  .update({ role: "superadmin", status: "approved" })
  .eq("id", superadmin.id)
  .select("id");

if (bootstrapError || bootstrapped.length !== 1) {
  throw new Error(
    `Unable to bootstrap the newly created local superadmin profile${bootstrapError ? `: ${bootstrapError.message}` : "."}`,
  );
}

const superadminClient = createClient(supabaseUrl, publishableKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
const { error: signInError } = await superadminClient.auth.signInWithPassword({
  email: superadmin.email,
  password: superadmin.password,
});

if (signInError) {
  throw new Error(
    `Unable to authenticate the new local superadmin for role assignment: ${signInError.message}`,
  );
}

for (const account of createdAccounts.filter(
  (candidate) => candidate.role !== "superadmin",
)) {
  const { error } = await superadminClient.rpc("set_profile_access", {
    p_user_id: account.id,
    p_role: account.role,
    p_status: "approved",
  });

  if (error) {
    throw new Error(
      `The existing set_profile_access RPC could not assign the local ${account.role} role: ${error.message}`,
    );
  }
}

for (const account of createdAccounts.filter(
  (candidate) => candidate.role !== "superadmin",
)) {
  const roleClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { error: roleSignInError } = await roleClient.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (roleSignInError) {
    throw new Error(
      `Unable to sign in as the local ${account.role} test account: ${roleSignInError.message}`,
    );
  }

  const { error: authorizationError } = await roleClient.rpc(
    "set_profile_access",
    {
      p_user_id: account.id,
      p_role: account.role,
      p_status: "approved",
    },
  );

  if (authorizationError?.code !== "42501") {
    throw new Error(
      `Expected the ${account.role} account's set_profile_access call to fail with 42501; it did not.`,
    );
  }
}

const accountIds = createdAccounts.map((account) => account.id);
const { data: verifiedProfiles, error: verificationError } = await adminClient
  .from("profiles")
  .select("id, role, status")
  .in("id", accountIds);

if (verificationError) {
  throw new Error(
    `Unable to verify the created test profiles: ${verificationError.message}`,
  );
}

for (const account of createdAccounts) {
  const profile = verifiedProfiles.find(
    (candidate) => candidate.id === account.id,
  );

  if (
    profile?.role !== account.role ||
    profile.status !== "approved"
  ) {
    throw new Error(
      `The local ${account.role} profile did not have the expected approved status.`,
    );
  }
}

console.log(
  "Created and verified local test profiles: user/approved, admin/approved, superadmin/approved.",
);
console.log(
  "Verified that both user and admin accounts are denied set_profile_access with SQLSTATE 42501.",
);
