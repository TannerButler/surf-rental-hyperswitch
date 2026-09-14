import { sql } from "@/lib/server/db";

type ReservationPaymentRow = {
  reservation_id: string;
  reservation_status: string;
  amount_cents: number;
  currency: string;
  hyperswitch_payment_id: string;
};

type HyperswitchPayment = {
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
};

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: reservationId } = await context.params;

  if (!isValidUuid(reservationId)) {
    return Response.json(
      { error: "Invalid reservation ID" },
      { status: 400 }
    );
  }

  // 1. Load our trusted reservation + payment relationship.
  let record: ReservationPaymentRow | undefined;

  try {
    const rows = await sql`
      SELECT
        r.id AS reservation_id,
        r.status AS reservation_status,
        r.amount_cents,
        r.currency,
        p.hyperswitch_payment_id
      FROM reservations r
      JOIN payments p
        ON p.reservation_id = r.id
      WHERE r.id = ${reservationId}
      LIMIT 1
    `;

    record = rows[0] as ReservationPaymentRow | undefined;
  } catch (error) {
    console.error("Failed to load reservation/payment:", error);

    return Response.json(
      { error: "Failed to load reservation" },
      { status: 500 }
    );
  }

  if (!record) {
    return Response.json(
      { error: "Reservation or payment not found" },
      { status: 404 }
    );
  }

  const apiKey = process.env.HYPERSWITCH_API_KEY;
  const baseUrl = process.env.HYPERSWITCH_BASE_URL;

  if (!apiKey || !baseUrl) {
    console.error("Hyperswitch environment variables are missing");

    return Response.json(
      { error: "Payment service is not configured" },
      { status: 500 }
    );
  }

  // 2. Retrieve payment from Hyperswitch server-side.
  let payment: HyperswitchPayment;

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/payments/${record.hyperswitch_payment_id}?force_sync=true`,
      {
        method: "GET",
        headers: {
          "api-key": apiKey,
        },
        cache: "no-store",
      }
    );

    const responseBody = await response.json();

    if (!response.ok) {
      console.error(
        "Hyperswitch verification failed:",
        response.status,
        responseBody
      );

      return Response.json(
        { error: "Unable to verify payment" },
        { status: 502 }
      );
    }

    payment = responseBody as HyperswitchPayment;
  } catch (error) {
    console.error("Hyperswitch verification request failed:", error);

    return Response.json(
      { error: "Unable to verify payment" },
      { status: 502 }
    );
  }

  // 3. Verify identity and monetary values.
  if (
    payment.payment_id !== record.hyperswitch_payment_id ||
    payment.amount !== record.amount_cents ||
    payment.currency !== record.currency
  ) {
    console.error("Payment verification mismatch", {
      expectedPaymentId: record.hyperswitch_payment_id,
      actualPaymentId: payment.payment_id,
      expectedAmount: record.amount_cents,
      actualAmount: payment.amount,
      expectedCurrency: record.currency,
      actualCurrency: payment.currency,
    });

    return Response.json(
      { error: "Payment does not match reservation" },
      { status: 502 }
    );
  }

  // 4. Successful verification does NOT necessarily mean successful payment.
  if (payment.status !== "succeeded") {
    try {
      await sql`
        UPDATE payments
        SET
          status = ${payment.status},
          updated_at = NOW()
        WHERE reservation_id = ${reservationId}
      `;
    } catch (error) {
      console.error("Failed to update payment status:", error);

      return Response.json(
        { error: "Failed to update payment status" },
        { status: 500 }
      );
    }

    return Response.json({
      reservation_id: reservationId,
      payment_status: payment.status,
      reservation_status: record.reservation_status,
      confirmed: false,
    });
  }

  // 5. Only "succeeded" is allowed to confirm the reservation.
  try {
    await sql.transaction([
      sql`
        UPDATE payments
        SET
          status = 'succeeded',
          updated_at = NOW()
        WHERE reservation_id = ${reservationId}
      `,
      sql`
        UPDATE reservations
        SET status = 'confirmed'
        WHERE id = ${reservationId}
      `,
    ]);
  } catch (error) {
    console.error(
      "Failed to persist successful payment verification:",
      error
    );

    return Response.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }

  return Response.json({
    reservation_id: reservationId,
    payment_status: "succeeded",
    reservation_status: "confirmed",
    confirmed: true,
  });
}