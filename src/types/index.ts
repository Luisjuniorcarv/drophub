export type UserRole = "ADMIN" | "OPERATOR";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type OrderStatusType =
  | "AWAITING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "AWAITING_SUPPLIER"
  | "SENT_TO_SUPPLIER"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export interface DashboardMetrics {
  grossRevenue: number;
  totalOrders: number;
  averageTicket: number;
  cogsAmount: number;
  totalExpenses: number;
  netProfit: number;
  averageMargin: number;
  productsSold: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    status: OrderStatusType;
    createdAt: string;
  }>;
  topProducts: Array<{
    productId: string;
    name: string;
    unitsSold: number;
    revenue: number;
    profit: number;
  }>;
}

export interface CartItem {
  productId: string;
  variantId?: string | null;
  name: string;
  sku: string;
  price: number;
  image?: string;
  quantity: number;
  maxStock: number;
}
