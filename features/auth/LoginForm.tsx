"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { apiSend } from "@/lib/fetcher";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

interface Props {
  accounts: { email: string; name: string; role: string; description: string }[];
  demoPassword: string;
}

export function LoginForm({ accounts, demoPassword }: Props) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  async function signIn(values: Values) {
    setError(null);
    setPending(values.email);
    try {
      const r = await apiSend<{ home: string }>("/api/auth/login", values);
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : r.home);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPending(null);
    }
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <form onSubmit={form.handleSubmit(signIn)} className="space-y-4" noValidate>
        <h2 className="text-xl font-semibold">Sign in</h2>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!form.formState.errors.email} {...form.register("email")} />
          {form.formState.errors.email && <p className="text-xs text-danger">{form.formState.errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!form.formState.errors.password} {...form.register("password")} />
          {form.formState.errors.password && <p className="text-xs text-danger">{form.formState.errors.password.message}</p>}
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={!!pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <section aria-labelledby="demo-accounts" className="space-y-3">
        <div>
          <h2 id="demo-accounts" className="text-sm font-medium">Demo accounts</h2>
          <p className="text-xs text-muted-foreground">Password for all: {demoPassword}</p>
        </div>
        <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
          {accounts.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                disabled={!!pending}
                onClick={() => signIn({ email: a.email, password: demoPassword })}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {a.name} <span className="font-normal text-muted-foreground">· {a.role}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{a.description}</span>
                </span>
                <span className="text-xs text-muted-foreground">{pending === a.email ? "Signing in…" : ""}</span>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
