// Convex auth configuration — uses the Clerk JWT template named "convex".
// Set CLERK_JWT_ISSUER_DOMAIN in Convex deployment env via `npx convex env set`.
//   Example: https://vast-bat-90.clerk.accounts.dev
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
