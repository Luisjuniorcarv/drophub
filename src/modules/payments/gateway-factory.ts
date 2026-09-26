import { PaymentGateway, PAYMENT_GATEWAYS } from "./types";
import { MercadoPagoGateway } from "./gateways/mercadopago";
import { TestGateway } from "./gateways/test-gateway";

const instances: Map<string, PaymentGateway> = new Map();

/**
 * Retorna a instância singleton do gateway de pagamento solicitado.
 */
export function getPaymentGateway(gatewayName?: string): PaymentGateway {
  const rawTarget = (
    gatewayName ||
    process.env.PAYMENT_GATEWAY ||
    process.env.DEFAULT_PAYMENT_GATEWAY ||
    ""
  ).toUpperCase();
  
  let target: string = PAYMENT_GATEWAYS.TEST_GATEWAY;
  if (rawTarget.includes("MERCADO") || rawTarget === "MP") {
    target = PAYMENT_GATEWAYS.MERCADO_PAGO;
  }

  if (!instances.has(target)) {
    if (target === PAYMENT_GATEWAYS.MERCADO_PAGO) {
      instances.set(target, new MercadoPagoGateway());
    } else {
      instances.set(target, new TestGateway());
    }
  }

  return instances.get(target)!;
}
