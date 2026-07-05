import type { Order } from "./types.js";

export const fetchOrders = () => $fetch<Order[]>("/api/orders");
