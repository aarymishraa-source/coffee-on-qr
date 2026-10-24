"use client";

import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";
import { MonoLabel } from "@/components/ui/MonoLabel";

interface Story {
  farmerName: string;
  village: string;
  district: string;
  fpo: string;
  ingredient: string;
  harvestDate: string;
  grade: string;
  distanceKm: number | null;
  isDemo: boolean;
}

/**
 * Farm Story: who grew an ingredient in this dish. Shown only after a batch
 * was delivered and its grade checked at pickup, and only if the farmer
 * consented. Polls gently so it appears live during the demo.
 */
export function FarmStory({ dishId }: { dishId: string }) {
  const [story, setStory] = useState<Story | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/farm-story?dishId=${encodeURIComponent(dishId)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j: { ok: boolean; data: Story | null }) => alive && setStory(j.ok ? j.data : null))
        .catch(() => {});
    load();
    const id = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [dishId]);

  if (!story) return null;
  const date = new Date(story.harvestDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  return (
    <section className="mt-5" aria-labelledby="farm-story">
      <MonoLabel className="block" >
        <span id="farm-story">FROM THE FARM</span>
      </MonoLabel>
      <div className="mt-2 flex gap-3 rounded-2xl border border-line bg-oat px-4 py-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-matcha">
          <Sprout size={18} aria-hidden="true" />
        </span>
        <div className="text-sm leading-snug">
          <p className="font-semibold">
            {story.ingredient} grown by {story.farmerName}
          </p>
          <p className="text-muted">
            {story.village}, {story.district}
            {story.distanceKm != null ? ` · ${story.distanceKm} km away` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">
            Harvested {date} · Grade {story.grade}, checked at pickup · {story.fpo}
            {story.isDemo ? " · Demo data" : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
