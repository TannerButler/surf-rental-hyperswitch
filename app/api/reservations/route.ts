import { sql } from "@/lib/server/db";
import { getRentalPrice } from "@/lib/server/pricing";

function isValidRentalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

  // These values are controlled exclusively by the server.
  const serverControlledFields = [
    "amount_cents",
    "currency",
    "status",
  ];

  const suppliedServerField = serverControlledFields.find(
    (field) => field in input
  );

  if (suppliedServerField) {
    return Response.json(
      {
        error: `${suppliedServerField} cannot be supplied by the client`,
      },
      { status: 400 }
    );
  }

  const {
    board_id,
    rental_date,
    duration,
    customer_name,
    customer_email,
  } = input;

  if (
    typeof board_id !== "string" ||
    typeof rental_date !== "string" ||
    typeof duration !== "string" ||
    typeof customer_name !== "string" ||
    typeof customer_email !== "string"
  ) {
    return Response.json(
      { error: "Missing or invalid required fields" },
      { status: 400 }
    );
  }

  const trimmedName = customer_name.trim();
  const trimmedEmail = customer_email.trim().toLowerCase();

  if (!trimmedName) {
    return Response.json(
      { error: "Customer name is required" },
      { status: 400 }
    );
  }

  if (!isValidEmail(trimmedEmail)) {
    return Response.json(
      { error: "Invalid customer email" },
      { status: 400 }
    );
  }

  if (!isValidRentalDate(rental_date)) {
    return Response.json(
      {
        error: "Rental date must be a valid date in YYYY-MM-DD format",
      },
      { status: 400 }
    );
  }

  let amountCents: number;

  try {
    amountCents = getRentalPrice(board_id, duration);
  } catch {
    return Response.json(
      { error: "Invalid board or rental duration" },
      { status: 400 }
    );
  }

  try {
    const rows = await sql`
      INSERT INTO reservations (
        board_id,
        rental_date,
        duration,
        customer_name,
        customer_email,
        amount_cents,
        currency,
        status
      )
      VALUES (
        ${board_id},
        ${rental_date},
        ${duration},
        ${trimmedName},
        ${trimmedEmail},
        ${amountCents},
        'USD',
        'pending_payment'
      )
      RETURNING
        id,
        board_id,
        rental_date,
        duration,
        customer_name,
        customer_email,
        amount_cents,
        currency,
        status,
        created_at
    `;

    return Response.json(
      { reservation: rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create reservation:", error);

    return Response.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}