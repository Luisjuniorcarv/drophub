import { redirect, notFound } from "next/navigation";
import { getCustomerSession } from "@/modules/customer/auth";
import { getStorefrontOrder } from "@/modules/storefront/service";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerSingleOrderPage(props: Props) {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await props.params;

  try {
    const order = await getStorefrontOrder({
      orderId: id,
      customerId: session.id,
    });

    if (order) {
      redirect(`/pedido/${id}`);
    }
  } catch (error: any) {
    if (error.message === "FORBIDDEN") {
      redirect("/minha-conta/pedidos");
    }
    notFound();
  }

  notFound();
}
