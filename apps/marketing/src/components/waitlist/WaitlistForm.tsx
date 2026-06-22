import { useState } from "react";

import { Button, Input } from "@pipewatch/ui";

import { isValidEmail, subscribeWaitlist } from "@/lib/waitlist-api";
import { trackUmamiEvent } from "@/lib/umami";

type FormState = "idle" | "submitting" | "success";

type SuccessVariant = "subscribed" | "already_subscribed";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [formState, setFormState] = useState<FormState>("idle");
  const [successVariant, setSuccessVariant] = useState<SuccessVariant>("subscribed");

  function validateEmail(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
      return "Email is required.";
    }
    if (!isValidEmail(trimmed)) {
      return "Enter a valid email address.";
    }
    return undefined;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);

    const validationError = validateEmail(email);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setFieldError(undefined);
    setFormState("submitting");

    const result = await subscribeWaitlist(email);
    if (!result.ok) {
      setFormState("idle");
      if (result.error === "validation") {
        setFieldError("Enter a valid email address.");
        return;
      }
      setFormError("Something went wrong. Please try again.");
      return;
    }

    setSuccessVariant(result.data.status);
    setFormState("success");
    trackUmamiEvent("waitlist-subscribed", { status: result.data.status });
  }

  if (formState === "success") {
    if (successVariant === "already_subscribed") {
      return (
        <div className="waitlist-success">
          <p className="waitlist-success-title">You&apos;re already on the list</p>
          <p className="waitlist-success-body">
            This email is already registered. Check your inbox for the confirmation link if
            you haven&apos;t confirmed yet.
          </p>
        </div>
      );
    }

    return (
      <div className="waitlist-success">
        <p className="waitlist-success-title">Check your inbox</p>
        <p className="waitlist-success-body">
          We sent a confirmation link to {email.trim()}. Click it to complete your signup.
        </p>
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit} noValidate>
      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        value={email}
        disabled={formState === "submitting"}
        {...(fieldError ? { error: fieldError } : {})}
        onChange={(event) => {
          setEmail(event.target.value);
          if (fieldError) {
            setFieldError(undefined);
          }
          if (formError) {
            setFormError(undefined);
          }
        }}
        onBlur={() => {
          if (email.trim()) {
            setFieldError(validateEmail(email));
          }
        }}
      />

      {formError ? (
        <p className="pw-input-error-msg" role="alert">
          {formError}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        loading={formState === "submitting"}
        className="waitlist-submit"
        data-umami-event="waitlist-submit"
      >
        Join waitlist
      </Button>
    </form>
  );
}
