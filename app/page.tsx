"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BoardId =
  | "soft_top_8"
  | "funboard_7"
  | "performance_6";

type Duration = "half_day" | "full_day";

const boards = [
  {
    id: "soft_top_8" as BoardId,
    name: "8' Soft Top",
    description:
      "Stable and forgiving. A good choice for newer surfers and relaxed sessions.",
    halfDay: 3500,
    fullDay: 5000,
  },
  {
    id: "funboard_7" as BoardId,
    name: "7' Funboard",
    description:
      "A balanced all-around board with extra maneuverability.",
    halfDay: 4000,
    fullDay: 6000,
  },
  {
    id: "performance_6" as BoardId,
    name: "6' Performance Shortboard",
    description:
      "Responsive and fast for experienced surfers.",
    halfDay: 4500,
    fullDay: 7000,
  },
];

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function Home() {
  const router = useRouter();

  const [boardId, setBoardId] =
    useState<BoardId>("funboard_7");

  const [duration, setDuration] =
    useState<Duration>("half_day");

  const [rentalDate, setRentalDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === boardId)!,
    [boardId]
  );

  const displayPrice =
    duration === "half_day"
      ? selectedBoard.halfDay
      : selectedBoard.fullDay;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          board_id: boardId,
          rental_date: rentalDate,
          duration,
          customer_name: customerName,
          customer_email: customerEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to create reservation."
        );
      }

      const reservationId = data.reservation.id;

      router.push(
        `/review?reservation_id=${encodeURIComponent(
          reservationId
        )}`
      );
    } catch (error) {
      console.error(
        "Reservation creation failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to create reservation."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-stone-500">
            Single-location surf rentals
          </p>

          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Pick a board and get in the water.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
            Choose your board, rental duration, and date.
            Payment is completed securely at checkout.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {boards.map((board) => {
            const selected = board.id === boardId;

            return (
              <button
                key={board.id}
                type="button"
                onClick={() => setBoardId(board.id)}
                className={`rounded-2xl border p-6 text-left transition ${
                  selected
                    ? "border-stone-900 bg-white shadow-sm"
                    : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {board.name}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      {board.description}
                    </p>
                  </div>

                  <div
                    className={`mt-1 h-4 w-4 shrink-0 rounded-full border ${
                      selected
                        ? "border-[5px] border-stone-900"
                        : "border-stone-300"
                    }`}
                  />
                </div>

                <div className="mt-6 flex gap-6 border-t border-stone-100 pt-4 text-sm">
                  <div>
                    <p className="text-stone-500">
                      Half day
                    </p>

                    <p className="mt-1 font-medium">
                      {formatPrice(board.halfDay)}
                    </p>
                  </div>

                  <div>
                    <p className="text-stone-500">
                      Full day
                    </p>

                    <p className="mt-1 font-medium">
                      {formatPrice(board.fullDay)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div>
              <h2 className="text-2xl font-semibold">
                Reservation details
              </h2>

              <p className="mt-2 text-sm text-stone-600">
                We’ll create your reservation before you
                continue to payment.
              </p>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">
                  Rental date
                </span>

                <input
                  type="date"
                  required
                  value={rentalDate}
                  onChange={(event) =>
                    setRentalDate(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">
                  Duration
                </span>

                <select
                  value={duration}
                  onChange={(event) =>
                    setDuration(
                      event.target.value as Duration
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                >
                  <option value="half_day">
                    Half day
                  </option>

                  <option value="full_day">
                    Full day
                  </option>
                </select>
              </label>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">
                  Name
                </span>

                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={customerName}
                  onChange={(event) =>
                    setCustomerName(event.target.value)
                  }
                  placeholder="Alex Morgan"
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">
                  Email
                </span>

                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={customerEmail}
                  onChange={(event) =>
                    setCustomerEmail(event.target.value)
                  }
                  placeholder="alex@example.com"
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                />
              </label>
            </div>

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-8 w-full rounded-xl bg-stone-900 px-5 py-3.5 font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "Creating reservation..."
                : "Review reservation"}
            </button>
          </form>

          <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
            <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
              Your selection
            </p>

            <h2 className="mt-3 text-2xl font-semibold">
              {selectedBoard.name}
            </h2>

            <div className="mt-6 space-y-4 border-t border-stone-200 pt-6">
              <div className="flex justify-between gap-4">
                <span className="text-stone-600">
                  Duration
                </span>

                <span className="font-medium">
                  {duration === "half_day"
                    ? "Half day"
                    : "Full day"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-stone-600">
                  Estimated rental
                </span>

                <span className="font-medium">
                  {formatPrice(displayPrice)}
                </span>
              </div>
            </div>

            <p className="mt-6 text-xs leading-5 text-stone-500">
              Displayed pricing is for reference. The server
              calculates and stores the trusted reservation
              total when you continue.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}