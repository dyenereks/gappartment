import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

// Force Node runtime so Clerk's `auth()` can read cookies properly; UploadThing
// also relies on Node APIs internally. `force-dynamic` ensures the handler
// isn't statically optimized away on Netlify.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = createRouteHandler({ router: ourFileRouter });
