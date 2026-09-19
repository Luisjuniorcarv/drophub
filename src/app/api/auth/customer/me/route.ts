import { NextResponse } from "next/server";
import { getCustomerSession } from "@/modules/customer/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, customer: null }, { status: 200 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      addresses: {
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { orders: true },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ authenticated: false, customer: null }, { status: 200 });
  }

  return NextResponse.json({
    authenticated: true,
    customer,
  });
}
