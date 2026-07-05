export interface Order {
  id: string;
  symbol: string;
  price: string;
  quoteAmount: string;
  createdAt: string;
}

export const fetchOrders = () => $fetch<Order[]>("/api/orders");
