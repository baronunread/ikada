import "@fontsource-variable/figtree";
import "@fontsource-variable/jetbrains-mono";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Stress } from "./stress";
import "./app.css";

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <Stress />
    </StrictMode>,
  );
