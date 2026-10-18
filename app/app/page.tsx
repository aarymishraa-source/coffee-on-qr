"use client";

import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { CustomerApp } from "@/components/customer/CustomerApp";
import { useMounted } from "@/components/customer/shared";

export default function CustomerAppPage() {
  // The store lives in localStorage, so render only after mount to avoid hydration mismatches.
  const mounted = useMounted();
  return <PhoneFrame>{mounted ? <CustomerApp /> : <div className="h-full bg-paper" />}</PhoneFrame>;
}
