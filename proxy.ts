import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Os pedidos com cookies só podem ser alterados pelo próprio site.
  const origin = request.headers.get("origin");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !request.nextUrl.pathname.startsWith("/api/webhooks/") &&
    origin &&
    origin !== request.nextUrl.origin
  ) {
    return NextResponse.json(
      { error: "Origem do pedido inválida." },
      { status: 403 },
    );
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key && !key.includes("SUBSTITUIR")) {
    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    await client.auth.getUser();
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|webp)$).*)",
  ],
};
