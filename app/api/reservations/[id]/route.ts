import { sql } from "@/lib/server/db";

type ReservationRow = {
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

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!isValidUuid(id)) {
    return Response.json(
      { error: "Invalid reservation ID" },
      { status: 400 }
    );
  }

  try {
    const rows = await sql`
      SELECT
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
      FROM reservations
      WHERE id = ${id}
      LIMIT 1
    `;

    const reservation =
      rows[0] as ReservationRow | undefined;

    if (!reservation) {
      return Response.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    return Response.json({ reservation });
  } catch (error) {
    console.error("Failed to load reservation:", error);

    return Response.json(
      { error: "Failed to load reservation" },
      { status: 500 }
    );
  }
}