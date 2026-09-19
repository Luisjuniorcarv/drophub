import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createStorefrontOrder, getStorefrontOrder } from "@/modules/storefront/service";
import { createCheckoutPayment } from "@/modules/payments/service";
import {
  orchestratePaidOrderFulfillment,
  submitFulfillmentOrder,
  syncFulfillmentStatusFromSupplier,
  updateFulfillmentTracking,
  markFulfillmentDelivered,
} from "@/modules/fulfillment/service";
import { OrderStatus, FulfillmentStatus, PaymentMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

describe("ETAPA 15 — Dropshipping End-to-End Pipeline Integration Tests", () => {
  let supplier: any;
  let product: any;

  beforeEach(async () => {
    supplier = await prisma.supplier.create({
      data: {
        name: `Fornecedor E2E ${Date.now()}`,
        email: "e2e@fornecedor.com",
      },
    });

    product = await prisma.product.create({
      data: {
        name: "Headset Gamer Pro E2E",
        slug: `headset-e2e-${Date.now()}`,
        sku: `SKU-E2E-${Date.now()}`,
        description: "Headset de alta qualidade",
        costPrice: new Decimal(80.0),
        sellingPrice: new Decimal(220.0),
        stock: 50,
        supplierId: supplier.id,
      },
    });
  });

  it("should execute the complete dropshipping lifecycle: Checkout -> Payment -> Fulfillment -> Supplier -> Tracking -> Customer -> Delivered", async () => {
    // 1. Cliente compra na Storefront
    const order = await createStorefrontOrder({
      customer: {
        name: "Carlos Cliente E2E",
        email: `carlos_${Date.now()}@teste.com`,
        cpf: "12345678901",
        phone: "11988887777",
      },
      shippingAddress: {
        street: "Av. Paulista",
        number: "1000",
        complement: "Apto 101",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        postalCode: "01310-100",
      },
      items: [
        {
          productId: product.id,
          quantity: 2,
        },
      ],
      paymentMethod: PaymentMethod.PIX,
    });

    expect(order.id).toBeDefined();
    expect(order.status).toBe(OrderStatus.AWAITING_PAYMENT);
    expect(Number(order.totalAmount)).toBe(440.0);

    // 2. Pagamento aprovado no gateway (PIX / Teste)
    const paymentResult = await createCheckoutPayment({
      orderId: order.id,
      method: PaymentMethod.TEST_MODE,
      idempotencyKey: `pay_e2e_${order.id}`,
    });

    expect(paymentResult.gatewayResult.status).toBe("APPROVED");

    // 3. Orquestração de Fulfillment
    const orchResult = await orchestratePaidOrderFulfillment(order.id);
    expect(orchResult.success).toBe(true);
    expect(orchResult.fulfillmentsCreated).toBe(1);

    // Verificar se o pedido avançou para AWAITING_SUPPLIER ou SENT_TO_SUPPLIER
    const orderAfterPay = await prisma.order.findUnique({
      where: { id: order.id },
      include: { fulfillmentOrders: { include: { items: true, supplier: true } } },
    });

    expect(
      orderAfterPay?.status === OrderStatus.PAID ||
      orderAfterPay?.status === OrderStatus.AWAITING_SUPPLIER ||
      orderAfterPay?.status === OrderStatus.SENT_TO_SUPPLIER
    ).toBe(true);

    expect(orderAfterPay?.fulfillmentOrders.length).toBe(1);

    const fulfillment = orderAfterPay!.fulfillmentOrders[0];
    expect(fulfillment.supplierId).toBe(supplier.id);
    expect(fulfillment.items.length).toBe(1);
    expect(fulfillment.items[0].quantity).toBe(2);
    expect(Number(fulfillment.items[0].unitCostSnapshot)).toBe(80.0);

    // 4. Submissão ao Fornecedor
    const submitRes = await submitFulfillmentOrder(fulfillment.id, { force: true });
    expect(submitRes.success).toBe(true);
    expect(submitRes.fulfillment.status).toBe(FulfillmentStatus.ACKNOWLEDGED);
    expect(submitRes.fulfillment.externalOrderId).toBeDefined();

    // 5. Fornecedor envia o pacote com código de rastreamento
    const trackingCode = `BR${Date.now()}E2E`;
    const trackingRes = await updateFulfillmentTracking(fulfillment.id, {
      carrier: "Correios",
      trackingNumber: trackingCode,
      trackingUrl: `https://rastreamento.correios.com.br/app/index.php?codigo=${trackingCode}`,
    });

    expect(trackingRes.fulfillment.status).toBe(FulfillmentStatus.SHIPPED);
    expect(trackingRes.shipment.trackingNumber).toBe(trackingCode);

    // Pedido pai deve avançar para SHIPPED pois o único fulfillment foi despachado
    const orderAfterShipped = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(orderAfterShipped?.status).toBe(OrderStatus.SHIPPED);

    // 5. Cliente consulta o pedido na loja com token
    const customerOrderView = await getStorefrontOrder({
      orderId: order.id,
      trackingToken: order.trackingToken,
    });

    expect(customerOrderView.status).toBe(OrderStatus.SHIPPED);
    expect(customerOrderView.shipments.length).toBe(1);
    expect(customerOrderView.shipments[0].trackingNumber).toBe(trackingCode);
    expect(customerOrderView.shipments[0].trackings.length).toBeGreaterThan(0);

    // 6. Fornecedor confirma entrega
    const deliveredFulfillment = await markFulfillmentDelivered(fulfillment.id);
    expect(deliveredFulfillment.status).toBe(FulfillmentStatus.DELIVERED);

    // Pedido pai deve avançar para DELIVERED
    const orderFinal = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(orderFinal?.status).toBe(OrderStatus.DELIVERED);
  });
});
