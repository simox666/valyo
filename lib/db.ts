import { sql } from "@vercel/postgres";

export { sql };

export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  total_points: number;
  created_at: string;
}

export interface DbChallenge {
  id: string;
  creator_id: string;
  photo_url: string;
  label: string | null;
  true_price: string; // NUMERIC comes back as a string from the driver
  currency: string;
  created_at: string;
}

export interface DbGuess {
  id: string;
  challenge_id: string;
  guesser_id: string;
  guess_value: string;
  points: number;
  guessed_at: string;
}
