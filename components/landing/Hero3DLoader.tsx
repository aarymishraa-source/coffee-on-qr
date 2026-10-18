"use client";

import dynamic from "next/dynamic";

// WebGL only exists in the browser, so the 3D cup is never server-rendered.
export const Hero3DLoader = dynamic(() => import("./Hero3D"), { ssr: false });
