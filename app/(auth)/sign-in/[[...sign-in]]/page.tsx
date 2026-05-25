"use client";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            className="brand-mark"
            style={{ margin: "0 auto 12px", width: 44, height: 44, fontSize: 24 }}
          >
            🏠
          </div>
          <h1
            className="serif"
            style={{ fontSize: 28, letterSpacing: "-0.02em" }}
          >
            GAppartment
          </h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Sign in to manage your bills
          </p>
        </div>
        <SignIn
          appearance={{
            variables: {
              colorBackground: "var(--paper)",
              colorPrimary: "var(--ink)",
              colorText: "var(--ink)",
              colorTextSecondary: "var(--ink-soft)",
              colorInputBackground: "var(--paper)",
              colorInputText: "var(--ink)",
              colorNeutral: "var(--ink)",
              fontFamily: "var(--font-ui)",
              borderRadius: "12px",
            },
            elements: {
              rootBox: { width: "100%", display: "flex", justifyContent: "center" },
              card: {
                margin: "0 auto",
                background: "var(--paper)",
                border: "1px solid var(--line)",
                boxShadow: "var(--shadow-card)",
              },
              formButtonPrimary: {
                background: "var(--ink)",
                color: "var(--bg)",
              },
            },
          }}
        />
      </div>
    </div>
  );
}
