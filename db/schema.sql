CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  board_id TEXT NOT NULL,

  rental_date DATE NOT NULL,

  duration TEXT NOT NULL
    CHECK (duration IN ('half_day', 'full_day')),

  customer_name TEXT NOT NULL,

  customer_email TEXT NOT NULL,

  amount_cents INTEGER NOT NULL
    CHECK (amount_cents > 0),

  currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (currency = 'USD'),

  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'confirmed')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  reservation_id UUID NOT NULL UNIQUE
    REFERENCES reservations(id),

  hyperswitch_payment_id TEXT NOT NULL UNIQUE,

  amount_cents INTEGER NOT NULL
    CHECK (amount_cents > 0),

  currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (currency = 'USD'),

  status TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);