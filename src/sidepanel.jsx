import { createRoot } from "react-dom/client";
import { PopupApp } from "./popup/PopupApp.jsx";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(<PopupApp surface="sidepanel" />);
}
