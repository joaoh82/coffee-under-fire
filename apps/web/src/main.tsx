import { MobileHudPreview } from "./ui/MobileHudPreview";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ReportPreview } from "./ui/ReportPreview";
import { AssetPreview } from "./render/AssetPreview";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  import.meta.env.DEV && location.pathname === "/mobile-preview" ? (
    <MobileHudPreview />
  ) : location.pathname === "/asset-preview" ? (
    <AssetPreview />
  ) : import.meta.env.DEV && location.pathname === "/report-preview" ? (
    <ReportPreview />
  ) : (
    <App />
  ),
);
