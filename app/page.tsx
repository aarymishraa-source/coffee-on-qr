import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "Coffee on QR",
  description: "Taste, matched. Freshness, measured. Nothing wasted. The AI layer for cafés.",
};

export default function LandingPage() {
  return <Landing />;
}
