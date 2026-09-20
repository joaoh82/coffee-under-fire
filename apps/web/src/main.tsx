import { createRoot } from "react-dom/client";
import App from "./App";
import { ReportPreview } from "./ui/ReportPreview";
import { AssetPreview } from "./render/AssetPreview";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  location.pathname === "/asset-preview" ? (
    <AssetPreview />
  ) : import.meta.env.DEV && location.pathname === "/report-preview" ? (
    <ReportPreview />
  ) : (
    <App />
  ),
);
