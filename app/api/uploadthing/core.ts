import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";

const f = createUploadthing();

export const ourFileRouter = {
  // `awaitServerData: false` makes `startUpload` resolve as soon as the file
  // is in UploadThing — without waiting for our `onUploadComplete` callback to
  // finish polling back. On serverless (Netlify) that callback round-trip can
  // time out, which caused `startUpload` to return `undefined` even though the
  // file was uploaded successfully. The client already has `ufsUrl` on the
  // response object, so we don't need server data here.
  qrCode: f(
    { image: { maxFileSize: "4MB", maxFileCount: 1 } },
    { awaitServerData: false },
  )
    .middleware(async () => {
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");
      return { userId };
    })
    .onUploadComplete(async () => {
      // No-op — client uses `ufsUrl` directly from the upload response.
    }),

  paymentProof: f(
    { image: { maxFileSize: "8MB", maxFileCount: 1 } },
    { awaitServerData: false },
  )
    .middleware(async () => {
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");
      return { userId };
    })
    .onUploadComplete(async () => {
      // No-op — client uses `ufsUrl` directly from the upload response.
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
