"use client";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
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
            gAPPartment
          </h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Join your apartment group
          </p>
        </div>
        <SignUp
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
              rootBox: { width: "100%" },
              card: {
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
