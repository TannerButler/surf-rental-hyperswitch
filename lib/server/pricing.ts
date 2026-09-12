import "server-only";

export type RentalDuration = "half_day" | "full_day";

type BoardPricing = {
  name: string;
  prices: Record<RentalDuration, number>;
};

const SURFBOARD_CATALOG: Record<string, BoardPricing> = {
  soft_top_8: {
    name: "8' Soft Top",
    prices: {
      half_day: 3500,
      full_day: 5000,
    },
  },

  funboard_7: {
    name: "7' Funboard",
    prices: {
      half_day: 4000,
      full_day: 6000,
    },
  },

  performance_6: {
    name: "6' Performance Shortboard",
    prices: {
      half_day: 4500,
      full_day: 7000,
    },
  },
};

export function getRentalPrice(
  boardId: string,
  duration: string
): number {
  const board = SURFBOARD_CATALOG[boardId];

  if (!board) {
    throw new Error(`Invalid board ID: ${boardId}`);
  }

  if (duration !== "half_day" && duration !== "full_day") {
    throw new Error(`Invalid rental duration: ${duration}`);
  }

  return board.prices[duration];
}