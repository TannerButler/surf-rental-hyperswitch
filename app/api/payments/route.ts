import { sql } from "@/lib/server/db";

type ReservationRow = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
};

type HyperswitchPayment = {
  payment_id: string;
  client_secret: string | null;
  amount: number;
  currency: string;
  status: string;
};

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function createHyperswitchPaymentId(reservationId: string): string {
  const compactId = reservationId.replace(/-/g, "");

  return `pay_${compactId.slice(0, 26)}`;
}

async function retrieveHyperswitchPayment(
  baseUrl: string,
  apiKey: string,
  paymentId: string
): Promise<HyperswitchPayment> {
  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/payments/${paymentId}`,
    {
      method: "GET",
      headers: {
        "api-key": apiKey,
      },
    }
  );

  const responseBody = await response.json();

  if (!response.ok) {
    console.error(
      "Failed to retrieve Hyperswitch payment:",
      response.status,
      responseBody
    );

    throw new Error("Unable to retrieve existing payment");
  }

  return responseBody as HyperswitchPayment;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return Response.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const input = body as Record<string, unknown>;

  if (
    "amount" in input ||
    "amount_cents" in input ||
    "currency" in input
  ) {
    return Response.json(
      { error: "Payment amount and currency are server-controlled" },
      { status: 400 }
    );
  }

  const reservationId = input.reservation_id;

  if (
    typeof reservationId !== "string" ||
    !isValidUuid(reservationId)
  ) {
    return Response.json(
      { error: "Valid reservation_id is required" },
      { status: 400 }
    );
  }

  let reservation: ReservationRow | undefined;

  try {
    const rows = await sql`
      SELECT
        id,
        amount_cents,
        currency,
        status
      FROM reservations
      WHERE id = ${reservationId}
      LIMIT 1
    `;

    reservation = rows[0] as ReservationRow | undefined;
  } catch (error) {
    console.error("Failed to load reservation:", error);

    return Response.json(
      { error: "Failed to load reservation" },
      { status: 500 }
    );
  }

  if (!reservation) {
    return Response.json(
      { error: "Reservation not found" },
      { status: 404 }
    );
  }

  if (reservation.status !== "pending_payment") {
    return Response.json(
      { error: "Reservation is not awaiting payment" },
      { status: 409 }
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

  const hyperswitchPaymentId =
    createHyperswitchPaymentId(reservation.id);

  let hyperswitchPayment: HyperswitchPayment;

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/payments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          payment_id: hyperswitchPaymentId,
          amount: reservation.amount_cents,
          currency: reservation.currency,
          capture_method: "automatic",
        }),
      }
    );

    const responseBody = await response.json();

    if (response.ok) {
      hyperswitchPayment =
        responseBody as HyperswitchPayment;
    } else {
      const hyperswitchError = responseBody as {
        error?: {
          code?: string;
        };
      };

      console.log(
        "Hyperswitch error code:",
        hyperswitchError.error?.code
      );

      if (hyperswitchError.error?.code === "HE_01") {
        hyperswitchPayment =
          await retrieveHyperswitchPayment(
            baseUrl,
            apiKey,
            hyperswitchPaymentId
          );
      } else {
        console.error(
          "Hyperswitch payment creation failed:",
          response.status,
          responseBody
        );

        return Response.json(
          { error: "Unable to create payment" },
          { status: 502 }
        );
      }
    }
  } catch (error) {
    console.error("Hyperswitch request failed:", error);

    return Response.json(
      { error: "Unable to create payment" },
      { status: 502 }
    );
  }

  if (
    hyperswitchPayment.amount !== reservation.amount_cents ||
    hyperswitchPayment.currency !== reservation.currency
  ) {
    console.error(
      "Hyperswitch payment does not match reservation",
      {
        reservationAmount: reservation.amount_cents,
        reservationCurrency: reservation.currency,
        paymentAmount: hyperswitchPayment.amount,
        paymentCurrency: hyperswitchPayment.currency,
      }
    );

    return Response.json(
      { error: "Payment does not match reservation" },
      { status: 502 }
    );
  }

  if (
    !hyperswitchPayment.payment_id ||
    !hyperswitchPayment.client_secret
  ) {
    console.error(
      "Hyperswitch returned an incomplete payment response",
      hyperswitchPayment
    );

    return Response.json(
      { error: "Incomplete payment response" },
      { status: 502 }
    );
  }

  try {
    await sql`
      INSERT INTO payments (
        reservation_id,
        hyperswitch_payment_id,
        amount_cents,
        currency,
        status
      )
      VALUES (
        ${reservation.id},
        ${hyperswitchPayment.payment_id},
        ${reservation.amount_cents},
        ${reservation.currency},
        ${hyperswitchPayment.status}
      )
      ON CONFLICT (reservation_id)
      DO UPDATE SET
        hyperswitch_payment_id = EXCLUDED.hyperswitch_payment_id,
        amount_cents = EXCLUDED.amount_cents,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        updated_at = NOW()
    `;
  } catch (error) {
    console.error("Failed to persist payment:", error);

    return Response.json(
      { error: "Failed to persist payment" },
      { status: 500 }
    );
  }

  return Response.json({
    reservation_id: reservation.id,
    client_secret: hyperswitchPayment.client_secret,
  });
}