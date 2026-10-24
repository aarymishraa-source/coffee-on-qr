"use client";

import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed, Plus, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Switch } from "@/components/shadcn/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { ClientApiError, apiGet } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import {
  CONTACT_LABEL, LANGUAGES, STAGES, farmerFormSchema, type FarmerFormValues, type IngredientOption,
} from "../types";

interface Props {
  defaultValues?: Partial<FarmerFormValues>;
  submitLabel: string;
  onSubmit: (values: FarmerFormValues) => Promise<void>;
  onCancel?: () => void;
}

const EMPTY: FarmerFormValues = {
  name: "",
  phone: "",
  language: "mr",
  village: "",
  district: "Palghar",
  crops: [{ crop: "", stage: "VEGETATIVE" }],
  fpoId: "",
  fieldAgentId: "",
  areaAcres: "",
  lat: "",
  lng: "",
  contactPreference: "WHATSAPP",
  consentData: false,
  consentFarmStory: false,
};

function FieldError({ message, id }: { message?: string; id: string }) {
  return message ? (
    <p id={id} className="text-xs text-danger">
      {message}
    </p>
  ) : null;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-hairline py-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function FarmerForm({ defaultValues, submitLabel, onSubmit, onCancel }: Props) {
  const ingredients = useQuery({ queryKey: ["ingredients"], queryFn: () => apiGet<IngredientOption[]>("/api/ingredients") });
  const agents = useQuery({
    queryKey: ["agents", "assignable"],
    queryFn: () => apiGet<{ id: string; name: string; fpoId: string }[]>("/api/agents?assignable=1"),
  });
  const fpos = useQuery({ queryKey: ["fpos"], queryFn: () => apiGet<{ id: string; name: string }[]>("/api/fpos") });
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const form = useForm<FarmerFormValues>({
    resolver: zodResolver(farmerFormSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
  });
  const { register, control, handleSubmit, formState, setValue, watch } = form;
  const errors = formState.errors;
  const crops = useFieldArray({ control, name: "crops" });

  // With one option the assignment is fixed by role (agents register to themselves).
  const fixedAgent = agents.data?.length === 1 ? agents.data[0] : null;
  const fixedFpo = fpos.data?.length === 1 ? fpos.data[0] : null;
  useEffect(() => {
    if (fixedFpo && !watch("fpoId")) setValue("fpoId", fixedFpo.id);
    if (fixedAgent && !watch("fieldAgentId") && !defaultValues) setValue("fieldAgentId", fixedAgent.id);
  }, [fixedFpo, fixedAgent, setValue, watch, defaultValues]);

  function locate() {
    if (!navigator.geolocation) return setLocError("This device can't share its location.");
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue("lat", pos.coords.latitude.toFixed(5), { shouldValidate: true });
        setValue("lng", pos.coords.longitude.toFixed(5), { shouldValidate: true });
        setLocating(false);
      },
      () => {
        setLocError("Couldn't get the location. You can type it or leave it empty.");
        setLocating(false);
      },
      { timeout: 10_000 }
    );
  }

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (e) {
      const err = e as ClientApiError;
      if (err.code === "duplicate_phone") form.setError("phone", { message: err.message }, { shouldFocus: true });
      else form.setError("root", { message: err.message ?? "Couldn't save. Please try again." });
    }
  });

  const fpoId = watch("fpoId");
  const agentOptions = (agents.data ?? []).filter((a) => !fpoId || a.fpoId === fpoId);

  return (
    <form onSubmit={submit} noValidate className="pb-24 md:pb-0">
      <Section title="Farmer" description="How we reach them and in which language.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" autoComplete="off" aria-invalid={!!errors.name} aria-describedby="name-err" {...register("name")} />
            <FieldError id="name-err" message={errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile number</Label>
            <Input id="phone" inputMode="tel" placeholder="98XXXXXXXX" aria-invalid={!!errors.phone} aria-describedby="phone-err" {...register("phone")} />
            <FieldError id="phone-err" message={errors.phone?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="language">Preferred language</Label>
            <Controller
              control={control}
              name="language"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="language" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact">Contact by</Label>
            <Controller
              control={control}
              name="contactPreference"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="contact" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTACT_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </Section>

      <Section title="Farm" description="Village, area and an optional location pin.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="village">Village</Label>
            <Input id="village" aria-invalid={!!errors.village} aria-describedby="village-err" {...register("village")} />
            <FieldError id="village-err" message={errors.village?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="district">District</Label>
            <Input id="district" aria-invalid={!!errors.district} aria-describedby="district-err" {...register("district")} />
            <FieldError id="district-err" message={errors.district?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area">
              Cultivated area <span className="font-normal text-muted-foreground">(acres, optional)</span>
            </Label>
            <Input id="area" inputMode="decimal" aria-invalid={!!errors.areaAcres} aria-describedby="area-err" {...register("areaAcres")} />
            <FieldError id="area-err" message={errors.areaAcres?.message} />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-2">
            <Label htmlFor="lat">
              Farm location <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Button type="button" variant="ghost" size="sm" onClick={locate} disabled={locating}>
              <LocateFixed aria-hidden="true" />
              {locating ? "Finding location…" : "Use this phone's location"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input id="lat" inputMode="decimal" placeholder="Latitude" aria-label="Latitude" aria-invalid={!!errors.lat} {...register("lat")} />
            <Input inputMode="decimal" placeholder="Longitude" aria-label="Longitude" aria-invalid={!!errors.lng} {...register("lng")} />
          </div>
          <FieldError id="lat-err" message={errors.lat?.message ?? errors.lng?.message ?? locError ?? undefined} />
        </div>
      </Section>

      <Section title="Crops" description="What they grow and how far along it is. Offers go to farmers growing the crop.">
        <ul className="space-y-3">
          {crops.fields.map((f, i) => (
            <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2">
              <div className="space-y-1">
                <Controller
                  control={control}
                  name={`crops.${i}.crop`}
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full" aria-label={`Crop ${i + 1}`} aria-invalid={!!errors.crops?.[i]?.crop}>
                        <SelectValue placeholder={ingredients.isLoading ? "Loading…" : "Pick a crop"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(ingredients.data ?? []).map((ing) => (
                          <SelectItem key={ing.id} value={ing.id}>
                            {ing.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError id={`crop-${i}-err`} message={errors.crops?.[i]?.crop?.message} />
              </div>
              <Controller
                control={control}
                name={`crops.${i}.stage`}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-label={`Stage of crop ${i + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove crop ${i + 1}`}
                disabled={crops.fields.length === 1}
                onClick={() => crops.remove(i)}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        <FieldError id="crops-err" message={errors.crops?.message ?? errors.crops?.root?.message} />
        <Button type="button" variant="ghost" size="sm" onClick={() => crops.append({ crop: "", stage: "VEGETATIVE" })}>
          <Plus aria-hidden="true" />
          Add another crop
        </Button>
      </Section>

      <Section title="FPO and field agent">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fpo">FPO membership</Label>
            {fixedFpo ? (
              <p id="fpo" className="flex h-9 items-center text-sm">
                {fixedFpo.name}
              </p>
            ) : (
              <Controller
                control={control}
                name="fpoId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger id="fpo" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not a member</SelectItem>
                      {(fpos.data ?? []).map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agent">Field agent</Label>
            {fixedAgent ? (
              <p id="agent" className="flex h-9 items-center text-sm">
                {fixedAgent.name}
              </p>
            ) : (
              <Controller
                control={control}
                name="fieldAgentId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger id="agent" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not assigned yet</SelectItem>
                      {agentOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </div>
        </div>
      </Section>

      <Section title="Consent" description="Read these to the farmer in their language before switching them on.">
        <Controller
          control={control}
          name="consentData"
          render={({ field }) => (
            <div className={cn("flex items-start justify-between gap-4", errors.consentData && "text-danger")}>
              <Label htmlFor="consent-data" className="block font-normal leading-relaxed">
                <span className="block font-medium text-foreground">Store my details and message me</span>
                <span className="block text-sm text-muted-foreground">
                  Coffee on QR keeps my name, phone, village and crops to send me café orders and crop help. I can ask to be removed at any
                  time.
                </span>
              </Label>
              <Switch id="consent-data" checked={field.value} onCheckedChange={field.onChange} aria-describedby="consent-err" />
            </div>
          )}
        />
        <FieldError id="consent-err" message={errors.consentData?.message} />
        <Controller
          control={control}
          name="consentFarmStory"
          render={({ field }) => (
            <div className="flex items-start justify-between gap-4">
              <Label htmlFor="consent-story" className="block font-normal leading-relaxed">
                <span className="block font-medium text-foreground">Show my name on café menus</span>
                <span className="block text-sm text-muted-foreground">
                  When cafés use my produce, customers can see my first name, village and harvest date on the dish. Optional.
                </span>
              </Label>
              <Switch id="consent-story" checked={field.value} onCheckedChange={field.onChange} />
            </div>
          )}
        />
      </Section>

      {errors.root?.message && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {errors.root.message}
        </p>
      )}
      <div className="pb-safe fixed inset-x-0 bottom-14 z-30 flex justify-end gap-2 border-t border-hairline bg-surface p-4 md:static md:border-0 md:bg-transparent md:px-0">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
