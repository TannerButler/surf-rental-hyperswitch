"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

function formatStatus(status: string) {
  return status
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

export default function ReviewPage() {
  const router = useRouter();

  const [reservation, setReservation] =
    useState<Reservation | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReservation() {
      const reservationId =
        new URLSearchParams(window.location.search).get(
          "reservation_id"
        );

      if (!reservationId) {
        setError(
          "No reservation was provided. Please return to the storefront and try again."
        );
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/reservations/${encodeURIComponent(
            reservationId
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (response.status === 404) {
          setError(
            "We couldn't find that reservation."
          );
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.error ?? "Unable to load reservation."
          );
        }

        setReservation(data.reservation as Reservation);
      } catch (error) {
        console.error(
          "Failed to load reservation:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load reservation."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadReservation();
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-stone-50 px-5 py-16 text-stone-900">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
            <p className="text-stone-600">
              Loading your reservation...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !reservation) {
    return (
      <main className="min-h-screen bg-stone-50 px-5 py-16 text-stone-900">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold">
              Unable to review reservation
            </h1>

            <p className="mt-3 text-stone-600">
              {error || "Unable to load reservation."}
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
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-16">
        <Link
          href="/"
          className="text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          ← Back to storefront
        </Link>

        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.15em] text-stone-500">
              Review reservation
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {boardName}
            </h1>

            <p className="mt-2 text-sm text-stone-500">
              Check your details before continuing to
              payment.
            </p>
          </div>

          <div className="mt-8 space-y-5 border-t border-stone-200 pt-6">
            <div className="flex items-start justify-between gap-6">
              <span className="text-stone-600">
                Rental date
              </span>

              <span className="text-right font-medium">
                {formatRentalDate(
                  reservation.rental_date
                )}
              </span>
            </div>

            <div className="flex items-start justify-between gap-6">
              <span className="text-stone-600">
                Duration
              </span>

              <span className="text-right font-medium">
                {formatDuration(reservation.duration)}
              </span>
            </div>

            <div className="flex items-start justify-between gap-6">
              <span className="text-stone-600">
                Name
              </span>

              <span className="text-right font-medium">
                {reservation.customer_name}
              </span>
            </div>

            <div className="flex items-start justify-between gap-6">
              <span className="text-stone-600">
                Email
              </span>

              <span className="break-all text-right font-medium">
                {reservation.customer_email}
              </span>
            </div>

            <div className="flex items-start justify-between gap-6">
              <span className="text-stone-600">
                Status
              </span>

              <span className="text-right font-medium">
                {formatStatus(reservation.status)}
              </span>
            </div>
          </div>

          <div className="mt-8 border-t border-stone-200 pt-6">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-sm text-stone-500">
                  Rental total
                </p>

                <p className="mt-1 text-xs text-stone-400">
                  Calculated by the server
                </p>
              </div>

              <p className="text-3xl font-semibold">
                {formatPrice(
                  reservation.amount_cents,
                  reservation.currency
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/checkout?reservation_id=${encodeURIComponent(
                  reservation.id
                )}`
              )
            }
            className="mt-8 w-full rounded-xl bg-stone-900 px-5 py-3.5 font-medium text-white transition hover:bg-stone-800"
          >
            Continue to payment
          </button>

          <p className="mt-4 text-center text-xs leading-5 text-stone-500">
            Your payment will be completed securely on the
            next step.
          </p>
        </div>
      </div>
    </main>
  );
}