import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND = (
  process.env.ARONNO_API_ORIGIN || "http://localhost:3000"
)
  .replace(/\/$/, "")
  .replace(/\/api$/, "");

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  const parts = header.split(/;\s*/);
  for (const part of parts) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return undefined;
}

/**
 * Nest sets Path=/api (mobile-friendly). For the Next BFF the browser must
 * send cookies on /admin page navigations too, so rewrite Path to /.
 * Also drop Domain so cookies stick to the web origin.
 */
function rewriteSetCookieForWeb(raw: string): string {
  return raw
    .replace(/;\s*Path=\/api/gi, "; Path=/")
    .replace(/;\s*Domain=[^;]*/gi, "");
}

function collectSetCookies(upstream: Response): string[] {
  const anyHeaders = upstream.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = upstream.headers.get("set-cookie");
  return single ? [single] : [];
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join("/");
  const search = req.nextUrl.search;
  const target = `${BACKEND}/api/${path}${search}`;

  const headers = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const ua = req.headers.get("user-agent");
  if (ua) headers.set("user-agent", ua);

  // Nest CSRF expects header to match cookie for non-public mutations
  const csrf =
    req.headers.get("x-csrf-token") ||
    parseCookie(cookie, "aronno_csrf");
  if (csrf) headers.set("x-csrf-token", csrf);

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "NETWORK",
          message: "সার্ভারে সংযোগ করা যায়নি। API চালু আছে কি?",
        },
      },
      { status: 502 },
    );
  }

  const resHeaders = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) resHeaders.set("content-type", ct);

  for (const c of collectSetCookies(upstream)) {
    resHeaders.append("set-cookie", rewriteSetCookieForWeb(c));
  }

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: upstream.status,
    headers: resHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
