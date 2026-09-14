"use client";

import { useEffect, useState } from "react";

type VerificationResponse = {
  reservation_id: string;
  payment_status: string;
  reservation_status: string;
  confirmed: boolean;
};

type PageState =
  | "verifying"
  | "confirmed"
  | "pending"
  | "not_completed"
  | "error";

export default function PaymentReturnPage() {
  const [state, setState] =
    useState<PageState>("verifying");

  const [paymentStatus, setPaymentStatus] =
    useState<string | null>(null);

  const [message, setMessage] = useState("");

  useEffect(() => {
    async function verifyPayment() {
      const reservationId =
        new URLSearchParams(window.location.search).get(
          "reservation_id"
        );

      if (!reservationId) {
        setState("error");
        setMessage("Reservation information is missing.");
        return;
      }

      try {
        const response = await fetch(
          `/api/reservations/${encodeURIComponent(
            reservationId
          )}/verify-payment`,
          {
            method: "POST",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ?? "Unable to verify payment."
          );
        }

        const result = data as VerificationResponse;

        setPaymentStatus(result.payment_status);

        if (result.confirmed) {
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
         * Any other legitimate non-success state remains pending.
         * Examples can include "processing" or states waiting on
         * additional payment processing.
         */
        setState("pending");
      } catch (error) {
        console.error("Payment verification failed:", error);

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

  return (
    <main className="mx-auto min-h-screen max-w-xl p-8">
      {state === "verifying" && (
        <>
          <h1 className="text-2xl font-semibold">
            Verifying your payment...
          </h1>

          <p className="mt-3">
            Please wait while we confirm your payment.
          </p>
        </>
      )}

      {state === "confirmed" && (
        <>
          <h1 className="text-2xl font-semibold">
            Reservation confirmed
          </h1>

          <p className="mt-3">
            Your payment was successfully verified and your
            surfboard reservation is confirmed.
          </p>
        </>
      )}

      {state === "pending" && (
        <>
          <h1 className="text-2xl font-semibold">
            Payment is still processing
          </h1>

          <p className="mt-3">
            Your reservation is not confirmed yet. Please
            refresh this page in a moment to check again.
          </p>

          {paymentStatus && (
            <p className="mt-3 text-sm">
              Payment status: {paymentStatus}
            </p>
          )}
        </>
      )}

      {state === "not_completed" && (
        <>
          <h1 className="text-2xl font-semibold">
            Payment not completed
          </h1>

          <p className="mt-3">
            We could not confirm a successful payment for this
            reservation.
          </p>

          {paymentStatus && (
            <p className="mt-3 text-sm">
              Payment status: {paymentStatus}
            </p>
          )}
        </>
      )}

      {state === "error" && (
        <>
          <h1 className="text-2xl font-semibold">
            We couldn't verify your payment
          </h1>

          <p className="mt-3">
            {message ||
              "Please refresh the page and try again."}
          </p>
        </>
      )}
    </main>
  );
}