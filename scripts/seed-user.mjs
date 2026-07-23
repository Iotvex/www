#!/usr/bin/env node
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_EMAIL || "xlebpushek@gmail.com";
const password = process.env.SEED_PASSWORD || "9851";

if (!url || !key) {
  console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "xlebpushek", role: "admin" },
  }),
});
const body = await res.json();
if (!res.ok) {
  // already exists is ok
  if (String(body?.msg || body?.message || "").toLowerCase().includes("already") || res.status === 422) {
    console.log("user exists:", email);
    process.exit(0);
  }
  console.error(body);
  process.exit(1);
}
console.log("created user", email, body.id || body.user?.id);
