import { NextResponse } from "next/server";
import { clearCustomerSessionCookie } from "@/modules/customer/auth";

export async function POST() {
  await clearCustomerSessionCookie();
  return NextResponse.json({
    success: true,
    message: "Logout realizado com sucesso.",
  });
}
