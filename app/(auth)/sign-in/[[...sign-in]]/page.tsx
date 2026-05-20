"use client";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🏠</div>
          <h1 className="text-2xl font-bold text-brown-600">GAppartment</h1>
          <p className="text-charcoal-300 mt-1">Sign in to manage your bills</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-white shadow-sm border border-cream-400 rounded-2xl",
              headerTitle: "text-brown-600",
              headerSubtitle: "text-charcoal-300",
              socialButtonsBlockButton:
                "border-cream-400 text-charcoal-500 hover:bg-cream-100",
              formButtonPrimary:
                "bg-brown-600 hover:bg-brown-500 text-white",
              footerActionLink: "text-brown-500 hover:text-brown-600",
              formFieldInput:
                "border-cream-400 focus:border-brown-500 focus:ring-brown-500",
            },
          }}
        />
      </div>
    </div>
  );
}
