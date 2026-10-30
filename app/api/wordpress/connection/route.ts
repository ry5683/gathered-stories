import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { encryptWordPressCredentials, wordpressBaseAddress, wordpressRequest } from "@/lib/wordpress";

const connectionSchema = z.object({
  siteUrl: z.string().trim().min(1).max(300),
  username: z.string().trim().min(1).max(120),
  applicationPassword: z.string().trim().min(8).max(300),
});

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to check WordPress settings." }, { status: 401 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("wordpress_connections").select("site_url").eq("user_id", user.id).maybeSingle();
    if (error) {
      console.error("WordPress connection lookup failed:", error.code ?? "database_error");
      return NextResponse.json({ error: "WordPress settings could not be loaded." }, { status: 500 });
    }
    return NextResponse.json({ connected: Boolean(data), siteUrl: data?.site_url ?? null });
  } catch (error) {
    console.error("WordPress connection settings are unavailable:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "WordPress integration is not configured on the server." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const validation = connectionSchema.safeParse(payload);
  if (!validation.success) return NextResponse.json({ error: "Enter the site URL, WordPress username, and application password." }, { status: 400 });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before connecting WordPress." }, { status: 401 });
    const siteUrl = await wordpressBaseAddress(validation.data.siteUrl);
    const credentials = {
      username: validation.data.username,
      applicationPassword: validation.data.applicationPassword.replace(/\s+/g, ""),
    };
    const admin = createSupabaseAdminClient();
    const credentialsCiphertext = encryptWordPressCredentials(credentials);
    await wordpressRequest(siteUrl, credentials, "/wp-json/wp/v2/users/me?context=edit", "GET");
    const { error } = await admin.from("wordpress_connections").upsert({
      user_id: user.id,
      site_url: siteUrl,
      credentials_ciphertext: credentialsCiphertext,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("WordPress connection save failed:", error.code ?? "database_error");
      return NextResponse.json({ error: "The WordPress connection could not be saved." }, { status: 500 });
    }
    return NextResponse.json({ connected: true, siteUrl });
  } catch (error) {
    console.error("WordPress connection failed:", error instanceof Error ? error.name : "unknown_error");
    const message = error instanceof Error && (
      error.message.startsWith("Enter a valid") ||
      error.message.startsWith("WordPress must") ||
      error.message.startsWith("The WordPress site")
    ) ? error.message : "WordPress could not be verified. Check the HTTPS URL and application password.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
