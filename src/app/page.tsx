"use client";

import dynamic from "next/dynamic";

// Das Spiel braucht den Browser (WebGL), darum kein Server-Rendering
const Game = dynamic(() => import("@/components/Game"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-sky-300 text-3xl text-white">
      Stadt wird gebaut... 🏗️
    </div>
  ),
});

export default function Home() {
  return <Game />;
}
