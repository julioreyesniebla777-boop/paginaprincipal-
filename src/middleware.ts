import NextAuth from "next-auth";
import { authConfig } from "@/server/auth/config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/panel/:path*", "/mi-cuenta/:path*", "/cuenta"],
};
