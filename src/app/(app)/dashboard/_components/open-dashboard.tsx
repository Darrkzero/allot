"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OpenDashboard() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (handle) router.push(`/dashboard/${handle}`);
      }}
    >
      <div className="flex flex-1 items-center gap-1 text-sm text-white/50">
        <span>/pay/</span>
        <input
          className="input"
          aria-label="Your link name"
          placeholder="your-link-name"
          value={handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
        />
      </div>
      <button className="btn" disabled={!handle}>Open</button>
    </form>
  );
}
