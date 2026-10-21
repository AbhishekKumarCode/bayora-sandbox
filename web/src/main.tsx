import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { StoreProvider } from "./lib/store";
import { Shell } from "./components/Shell";
import { Landing } from "./pages/Landing";
import { Overview } from "./pages/Overview";
import { Runs } from "./pages/Runs";
import { RunDetail } from "./pages/RunDetail";
import { Live } from "./pages/Live";
import { Library } from "./pages/Library";
import { Audit } from "./pages/Audit";
import { Settings } from "./pages/Settings";
import { Compare } from "./pages/Compare";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<Shell />}>
            <Route index element={<Overview />} />
            <Route path="runs" element={<Runs />} />
            <Route path="runs/:id" element={<RunDetail />} />
            <Route path="live" element={<Live />} />
            <Route path="library" element={<Library />} />
            <Route path="audit" element={<Audit />} />
            <Route path="compare" element={<Compare />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
