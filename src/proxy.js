export { proxy } from "./dashboardGuard";

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/api/:path*",
    "/v1",
    "/v1/:path*",
    "/codex/:path*",
  ],
};
