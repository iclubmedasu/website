"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui";
import { publicAPI } from "@/lib/api";

type FormState = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
    const [formState, setFormState] = useState<FormState>("idle");
    const [errorMessage, setErrorMessage] = useState("");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFormState("submitting");
        setErrorMessage("");

        const formData = new FormData(event.currentTarget);
        const payload = {
            name: String(formData.get("name") ?? ""),
            email: String(formData.get("email") ?? ""),
            subject: String(formData.get("subject") ?? ""),
            message: String(formData.get("message") ?? ""),
            website: String(formData.get("website") ?? ""),
        };

        try {
            await publicAPI.sendContact(payload);
            setFormState("success");
            event.currentTarget.reset();
        } catch (error) {
            setFormState("error");
            setErrorMessage(error instanceof Error ? error.message : "Failed to send your message.");
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-purple-100 bg-white p-8 shadow-sm">
            <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                    Name
                    <input
                        name="name"
                        type="text"
                        required
                        maxLength={120}
                        className="mt-2 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500"
                    />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                    Email
                    <input
                        name="email"
                        type="email"
                        required
                        className="mt-2 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500"
                    />
                </label>
            </div>

            <label className="block text-sm font-medium text-slate-700">
                Subject
                <input
                    name="subject"
                    type="text"
                    required
                    maxLength={200}
                    className="mt-2 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500"
                />
            </label>

            <label className="block text-sm font-medium text-slate-700">
                Message
                <textarea
                    name="message"
                    required
                    rows={6}
                    maxLength={5000}
                    className="mt-2 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500"
                />
            </label>

            <input
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
            />

            {formState === "success" ? (
                <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
                    Thanks for reaching out. We will get back to you soon.
                </p>
            ) : null}

            {formState === "error" ? (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
            ) : null}

            <Button type="submit" disabled={formState === "submitting"}>
                {formState === "submitting" ? "Sending..." : "Send Message"}
            </Button>
        </form>
    );
}
