import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("CHOWK is missing its application root.");

createRoot(root).render(
  <StrictMode>
    <main style={{ padding: "4rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>CHOWK</h1>
      <p>Lane-free traffic simulation</p>
    </main>
  </StrictMode>,
);
