import React from "react";
import JsonEditor from "./JsonEditor.jsx";

export default function App() {
  return <JsonEditor />;
}

import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(<App />);

