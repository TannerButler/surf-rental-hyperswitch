"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loadHyper } from "@juspay-tech/hyper-js";
import {
  HyperElements,
  UnifiedCheckout,
  useElements,
  useHyper,
} from "@juspay-tech/react-hyper-js";

type Reservation = {
  id: string;
  board_id: string;
  rental_date: string;
  duration: string;
  customer_name: string;
  customer_email: string;
  amount_cents: number;
  currency: string;
  status: string;
};

const boardNames: Record<string, string> = {
  soft_top_8: "8' Soft Top",
  funboard_7: "7' Funboard",
  performance_6: "6' Performance Shortboard",
};

function formatPrice(
  cents: number,
  currency: string
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDuration(duration: string) {
  if (duration === "half_day") {
    return "Half day";
  }

  if (duration === "full_day") {
    return "Full day";
  }

  return duration;
}

function formatRentalDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function CheckoutForm({
  reservationId,
}: {
  reservationId: string;
}) {
  const hyper = useHyper();
  const elements = useElements();

  const [isSubmitting, setIsSubmitting] =
    useState(false);

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

    const returnUrl =
      `${window.location.origin}/payment-return` +
      `?reservation_id=${encodeURIComponent(
        reservationId
      )}`;

    try {
      const result = await hyper.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setMessage(
          result.error.message ??
            "Unable to complete payment."
        );
        return;
      }

      /*
       * For a non-redirect card flow, confirmPayment()
       * returns here.
       *
       * We still do not treat the browser result as
       * authoritative. The return page will perform
       * server-side verification before confirming
       * the reservation.
       */
      window.location.assign(returnUrl);
    } catch (error) {
      console.error(
        "Payment confirmation failed:",
        error
      );

      setMessage(
        "Unable to submit the payment. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <UnifiedCheckout
        id="unified-checkout"
        options={{
          layout: "tabs",
        }}
      />

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={!hyper || !elements || isSubmitting}
        className="w-full rounded-xl bg-stone-900 px-5 py-3.5 font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? "Processing payment..."
          : "Pay securely"}
      </button>

      <p className="text-center text-xs leading-5 text-stone-500">
        Your reservation is confirmed only after the
        payment is verified successfully.
      </p>
    </form>
  );
}

export default function CheckoutPage() {
  const [reservation, setReservation] =
    useState<Reservation | null>(null);

  const [clientSecret, setClientSecret] =
    useState<string | null>(null);

  const [hyperPromise, setHyperPromise] =
    useState<ReturnType<typeof loadHyper> | null>(
      null
    );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * Prevent React development behavior from running
   * checkout initialization twice.
   *
   * Without this guard, Next.js development mode can
   * initialize HyperLoader twice and POST /api/payments
   * twice for the same page load.
   */
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;

    async function initializeCheckout() {
      const reservationId =
        new URLSearchParams(
          window.location.search
        ).get("reservation_id");

      if (!reservationId) {
        setError(
          "No reservation was provided. Please return to the storefront."
        );
        setIsLoading(false);
        return;
      }

      const publishableKey =
        process.env
          .NEXT_PUBLIC_HYPERSWITCH_PUBLISHABLE_KEY;

      if (!publishableKey) {
        setError(
          "Payment checkout is not configured."
        );
        setIsLoading(false);
        return;
      }

      try {
        /*
         * Load the persisted reservation first.
         *
         * The checkout summary uses these stored values.
         * It does not independently calculate a trusted
         * amount in the browser.
         */
        const reservationResponse = await fetch(
          `/api/reservations/${encodeURIComponent(
            reservationId
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const reservationData =
          await reservationResponse.json();

        if (!reservationResponse.ok) {
          throw new Error(
            reservationData.error ??
              "Unable to load reservation."
          );
        }

        setReservation(
          reservationData.reservation as Reservation
        );

        /*
         * Use the existing payment endpoint.
         *
         * This either creates the Hyperswitch payment
         * or safely recovers the existing deterministic
         * payment for this reservation.
         */
        const paymentResponse = await fetch(
          "/api/payments",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reservation_id: reservationId,
            }),
          }
        );

        const paymentData =
          await paymentResponse.json();

        if (!paymentResponse.ok) {
          throw new Error(
            paymentData.error ??
              "Unable to initialize payment."
          );
        }

        /*
         * Keep Hyperswitch initialization in the browser.
         *
         * customBackendUrl is intentionally preserved.
         * This was required for the working sandbox
         * integration and avoids the previous
         * "Failed to fetch" issue.
         */
        const loadedHyper = loadHyper(
          publishableKey,
          {
            customBackendUrl:
              "https://sandbox.hyperswitch.io",
          }
        );

        setHyperPromise(loadedHyper);
        setClientSecret(
          paymentData.client_secret
        );
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
      } finally {
        setIsLoading(false);
      }
    }

    initializeCheckout();
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-stone-50 px-5 py-16 text-stone-900">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
            <p className="text-stone-600">
              Preparing secure checkout...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (
    error ||
    !reservation ||
    !clientSecret ||
    !hyperPromise
  ) {
    return (
      <main className="min-h-screen bg-stone-50 px-5 py-16 text-stone-900">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold">
              Unable to start checkout
            </h1>

            <p className="mt-3 text-stone-600">
              {error ||
                "Payment checkout could not be loaded."}
            </p>

            <Link
              href="/"
              className="mt-6 inline-block font-medium underline underline-offset-4"
            >
              Back to storefront
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const boardName =
    boardNames[reservation.board_id] ??
    reservation.board_id;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
        <Link
          href={`/review?reservation_id=${encodeURIComponent(
            reservation.id
          )}`}
          className="text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          ← Back to reservation
        </Link>

        <div className="mt-6">
          <p className="text-sm font-medium uppercase tracking-[0.15em] text-stone-500">
            Secure checkout
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Complete your rental
          </h1>

          <p className="mt-2 text-stone-600">
            Enter your card details to complete the
            reservation.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <HyperElements
              hyper={hyperPromise}
              options={{
                clientSecret,
              }}
            >
              <CheckoutForm
                reservationId={reservation.id}
              />
            </HyperElements>
          </section>

          <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
            <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
              Reservation
            </p>

            <h2 className="mt-3 text-2xl font-semibold">
              {boardName}
            </h2>

            <div className="mt-6 space-y-4 border-t border-stone-200 pt-6">
              <div className="flex justify-between gap-4">
                <span className="text-stone-600">
                  Date
                </span>

                <span className="text-right font-medium">
                  {formatRentalDate(
                    reservation.rental_date
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-stone-600">
                  Duration
                </span>

                <span className="font-medium">
                  {formatDuration(
                    reservation.duration
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-stone-600">
                  Customer
                </span>

                <span className="text-right font-medium">
                  {reservation.customer_name}
                </span>
              </div>
            </div>

            <div className="mt-6 border-t border-stone-200 pt-6">
              <div className="flex items-end justify-between gap-4">
                <span className="font-medium">
                  Total
                </span>

                <span className="text-2xl font-semibold">
                  {formatPrice(
                    reservation.amount_cents,
                    reservation.currency
                  )}
                </span>
              </div>

              <p className="mt-2 text-xs text-stone-500">
                Trusted reservation total from the
                server.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}