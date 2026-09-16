"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type VerificationResponse = {
  reservation_id: string;
  payment_status: string;
  reservation_status: string;
  confirmed: boolean;
};

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
  created_at: string;
};

type PageState =
  | "verifying"
  | "confirmed"
  | "pending"
  | "not_completed"
  | "error";

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

export default function PaymentReturnPage() {
  const [state, setState] =
    useState<PageState>("verifying");

  const [paymentStatus, setPaymentStatus] =
    useState<string | null>(null);

  const [reservation, setReservation] =
    useState<Reservation | null>(null);

  const [message, setMessage] = useState("");

  /*
   * Prevent duplicate verification requests during
   * React development behavior.
   */
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;

    async function verifyPayment() {
      const reservationId =
        new URLSearchParams(
          window.location.search
        ).get("reservation_id");

      if (!reservationId) {
        setState("error");
        setMessage(
          "Reservation information is missing."
        );
        return;
      }

      try {
        /*
         * Existing source-of-truth verification flow.
         *
         * The browser does not decide whether payment
         * succeeded. The backend retrieves the payment
         * from Hyperswitch and verifies it.
         */
        const verificationResponse = await fetch(
          `/api/reservations/${encodeURIComponent(
            reservationId
          )}/verify-payment`,
          {
            method: "POST",
          }
        );

        const verificationData =
          await verificationResponse.json();

        if (!verificationResponse.ok) {
          throw new Error(
            verificationData.error ??
              "Unable to verify payment."
          );
        }

        const result =
          verificationData as VerificationResponse;

        setPaymentStatus(result.payment_status);

        if (result.confirmed) {
          /*
           * Verification has already succeeded.
           *
           * Now load the persisted reservation only
           * for the customer-facing confirmation
           * summary.
           */
          try {
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

            if (reservationResponse.ok) {
              setReservation(
                reservationData.reservation as Reservation
              );
            } else {
              console.error(
                "Unable to load confirmed reservation:",
                reservationData
              );
            }
          } catch (reservationError) {
            console.error(
              "Unable to load confirmed reservation:",
              reservationError
            );
          }

          setState("confirmed");
          return;
        }

        if (
          result.payment_status === "failed" ||
          result.payment_status === "cancelled" ||
          result.payment_status ===
            "requires_payment_method"
        ) {
          setState("not_completed");
          return;
        }

        /*
         * Any legitimate non-success, non-failure state
         * remains pending.
         */
        setState("pending");
      } catch (error) {
        console.error(
          "Payment verification failed:",
          error
        );

        setState("error");

        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to verify payment."
        );
      }
    }

    verifyPayment();
  }, []);

  const boardName = reservation
    ? boardNames[reservation.board_id] ??
      reservation.board_id
    : "";

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-16">
        {state === "verifying" && (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-stone-900" />

            <p className="mt-6 text-sm font-medium uppercase tracking-[0.15em] text-stone-500">
              Payment verification
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Verifying your payment
            </h1>

            <p className="mt-3 text-stone-600">
              Please wait while we confirm the payment
              securely.
            </p>
          </div>
        )}

        {state === "confirmed" && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
                ✓
              </div>

              <p className="mt-6 text-sm font-medium uppercase tracking-[0.15em] text-emerald-700">
                Payment verified
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Reservation confirmed
              </h1>

              <p className="mt-3 text-stone-600">
                Your payment was successfully verified
                and your surfboard is reserved.
              </p>
            </div>

            {reservation && (
              <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 p-5 sm:p-6">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
                    Reservation
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold">
                    {boardName}
                  </h2>
                </div>

                <div className="mt-6 space-y-4 border-t border-stone-200 pt-5">
                  <div className="flex justify-between gap-6">
                    <span className="text-stone-600">
                      Rental date
                    </span>

                    <span className="text-right font-medium">
                      {formatRentalDate(
                        reservation.rental_date
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between gap-6">
                    <span className="text-stone-600">
                      Duration
                    </span>

                    <span className="font-medium">
                      {formatDuration(
                        reservation.duration
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between gap-6">
                    <span className="text-stone-600">
                      Name
                    </span>

                    <span className="text-right font-medium">
                      {reservation.customer_name}
                    </span>
                  </div>

                  <div className="flex justify-between gap-6">
                    <span className="text-stone-600">
                      Email
                    </span>

                    <span className="break-all text-right font-medium">
                      {reservation.customer_email}
                    </span>
                  </div>
                </div>

                <div className="mt-6 border-t border-stone-200 pt-5">
                  <div className="flex items-end justify-between gap-6">
                    <div>
                      <p className="font-medium">
                        Total paid
                      </p>

                      <p className="mt-1 text-xs text-stone-500">
                        Verified against the stored
                        reservation
                      </p>
                    </div>

                    <p className="text-2xl font-semibold">
                      {formatPrice(
                        reservation.amount_cents,
                        reservation.currency
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Link
              href="/"
              className="mt-8 block w-full rounded-xl border border-stone-300 px-5 py-3.5 text-center font-medium transition hover:bg-stone-50"
            >
              Back to storefront
            </Link>
          </div>
        )}

        {state === "pending" && (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-700">
              …
            </div>

            <p className="mt-6 text-sm font-medium uppercase tracking-[0.15em] text-amber-700">
              Payment pending
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Payment is still processing
            </h1>

            <p className="mt-3 text-stone-600">
              Your reservation is not confirmed yet.
              Please refresh this page in a moment to
              check again.
            </p>

            {paymentStatus && (
              <p className="mt-5 text-sm text-stone-500">
                Current status: {paymentStatus}
              </p>
            )}

            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="mt-8 w-full rounded-xl bg-stone-900 px-5 py-3.5 font-medium text-white transition hover:bg-stone-800"
            >
              Check again
            </button>
          </div>
        )}

        {state === "not_completed" && (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl text-red-700">
              ×
            </div>

            <p className="mt-6 text-sm font-medium uppercase tracking-[0.15em] text-red-700">
              Payment incomplete
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Payment not completed
            </h1>

            <p className="mt-3 text-stone-600">
              We could not confirm a successful payment,
              so your reservation has not been confirmed.
            </p>

            {paymentStatus && (
              <p className="mt-5 text-sm text-stone-500">
                Current status: {paymentStatus}
              </p>
            )}

            <Link
              href="/"
              className="mt-8 block w-full rounded-xl border border-stone-300 px-5 py-3.5 font-medium transition hover:bg-stone-50"
            >
              Back to storefront
            </Link>
          </div>
        )}

        {state === "error" && (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-200 text-xl text-stone-700">
              !
            </div>

            <p className="mt-6 text-sm font-medium uppercase tracking-[0.15em] text-stone-500">
              Verification issue
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              We couldn&apos;t verify your payment
            </h1>

            <p className="mt-3 text-stone-600">
              {message ||
                "Please refresh the page and try again."}
            </p>

            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="mt-8 w-full rounded-xl bg-stone-900 px-5 py-3.5 font-medium text-white transition hover:bg-stone-800"
            >
              Try verification again
            </button>

            <Link
              href="/"
              className="mt-3 block w-full px-5 py-3 text-sm font-medium text-stone-600 hover:text-stone-900"
            >
              Back to storefront
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}