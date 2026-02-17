"use client";

import dynamic from "next/dynamic";

const Auth3DScene = dynamic(
  () => import("@/components/auth/auth-3d-scene"),
  { ssr: false }
);

export default function Auth3DSceneLoader() {
  return <Auth3DScene />;
}
