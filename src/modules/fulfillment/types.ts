import { FulfillmentStatus } from "@prisma/client";

export interface SupplierItemInput {
  sku: string;
  name: string;
  quantity: number;
  unitCost: number;
  metadata?: Record<string, any>;
}

export interface SupplierRecipientInput {
  name: string;
  cpf?: string;
  phone?: string;
  email?: string;
  street: string;
  number?: string;
  complement?: string | null;
  neighborhood?: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface SupplierCreateOrderInput {
  fulfillmentOrderId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  recipient: SupplierRecipientInput;
  items: SupplierItemInput[];
  notes?: string | null;
}

export interface SupplierCreateOrderOutput {
  success: boolean;
  externalOrderId?: string;
  supplierOrderNumber?: string;
  status: "SUBMITTED" | "ACKNOWLEDGED" | "FAILED";
  rawResponse?: any;
  errorMessage?: string;
}

export interface SupplierGetStatusInput {
  externalOrderId: string;
  supplierOrderNumber?: string;
}

export interface SupplierOrderStatusOutput {
  success: boolean;
  status: FulfillmentStatus;
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  rawResponse?: any;
  errorMessage?: string;
}

export interface SupplierCancelOrderInput {
  externalOrderId: string;
  reason: string;
}

export interface SupplierCancelOrderOutput {
  success: boolean;
  cancelled: boolean;
  rawResponse?: any;
  errorMessage?: string;
}

export interface CreateFulfillmentResult {
  fulfillments: Array<{
    id: string;
    orderId: string;
    supplierId: string | null;
    supplierName: string;
    status: FulfillmentStatus;
    itemsCount: number;
  }>;
  totalFulfillments: number;
}
