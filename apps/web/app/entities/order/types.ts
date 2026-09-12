export interface Order {
  id: string;
  symbol: string;
  mode: string;
  status: string;
  price: string | null;
  quoteAmount: string;
  createdAt: string;
}
