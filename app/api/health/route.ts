import { checkDatabaseConnection } from "@/lib/server/db";

export async function GET() {
  try {
    const databaseConnected = await checkDatabaseConnection();

    return Response.json({
      ok: true,
      database: databaseConnected ? "connected" : "error",
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    return Response.json(
      {
        ok: false,
        database: "error",
      },
      { status: 500 }
    );
  }
}