"use client";

import { useEffect, useRef, useState } from "react";
import { loadHyper } from "@juspay-tech/hyper-js";
import {
  HyperElements,
  UnifiedCheckout,
  useElements,
  useHyper,
} from "@juspay-tech/react-hyper-js";

const publishableKey =
  process.env.NEXT_PUBLIC_HYPERSWITCH_PUBLISHABLE_KEY;

function CheckoutForm() {
  const hyper = useHyper();
  const elements = useElements();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!hyper || !elements || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const result = await hyper.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-return`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setMessage(
          result.error.message ?? "Unable to complete payment."
        );
        return;
      }

      setMessage(
        result.status
          ? `Payment submitted: ${result.status}`
          : "Payment submitted."
      );
    } catch (error) {
      console.error("Payment confirmation failed:", error);

      setMessage("Unable to complete payment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-xl space-y-6"
    >
      <UnifiedCheckout
        id="unified-checkout"
        options={{
          layout: "tabs",
        }}
        onReady={() => {
          console.log("UnifiedCheckout is ready");
        }}
      />

      <button
        type="submit"
        disabled={!hyper || !elements || isSubmitting}
        className="w-full rounded bg-black px-4 py-3 text-white disabled:opacity-50"
      >
        {isSubmitting ? "Processing..." : "Pay now"}
      </button>

      {message && (
        <p className="text-sm">
          {message}
        </p>
      )}
    </form>
  );
}

export default function CheckoutPage() {
  const [clientSecret, setClientSecret] =
    useState<string | null>(null);

  const [hyperPromise, setHyperPromise] =
    useState<ReturnType<typeof loadHyper> | null>(null);

  const [error, setError] = useState("");

  const hyperInitialized = useRef(false);

  useEffect(() => {
    async function initializeCheckout() {
      if (!publishableKey) {
        setError(
          "Hyperswitch publishable key is not configured."
        );
        return;
      }

      /*
       * loadHyper needs access to browser APIs like `document`,
       * so we initialize it inside useEffect rather than at the
       * top level of the module.
       *
       * The ref prevents us from initializing HyperLoader more
       * than once during React development behavior.
       */
      if (!hyperInitialized.current) {
        hyperInitialized.current = true;

        setHyperPromise(
          loadHyper(publishableKey, {
            customBackendUrl: "https://sandbox.hyperswitch.io",
          })
        );
      }

      const reservationId =
        new URLSearchParams(window.location.search).get(
          "reservation_id"
        );

      if (!reservationId) {
        setError("reservation_id is required.");
        return;
      }

      try {
        const response = await fetch("/api/payments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reservation_id: reservationId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ?? "Unable to initialize payment."
          );
        }

        setClientSecret(data.client_secret);
      } catch (error) {
        console.error(
          "Checkout initialization failed:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Unable to initialize checkout."
        );
      }
    }

    initializeCheckout();
  }, []);

  if (error) {
    return (
      <main className="p-8">
        <p>{error}</p>
      </main>
    );
  }

  if (!clientSecret || !hyperPromise) {
    return (
      <main className="p-8">
        <p>Loading checkout...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="mb-8 text-center text-2xl font-semibold">
        Complete your rental
      </h1>

      <HyperElements
        hyper={hyperPromise}
        options={{
          clientSecret,
        }}
      >
        <CheckoutForm />
      </HyperElements>
    </main>
  );
}