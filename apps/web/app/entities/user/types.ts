export interface CurrentUser {
  id: string;
  telegramUserId: string;
  username: string | null;
  firstName: string | null;
}

export interface MeResponse {
  user: CurrentUser | null;
}

// Shape of the object Telegram's login widget hands to the onauth callback.
export interface TelegramAuthPayload {
  id: number;
  auth_date: number;
  hash: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}
