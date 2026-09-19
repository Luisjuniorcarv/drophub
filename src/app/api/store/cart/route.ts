import { NextRequest, NextResponse } from "next/server";
import { getStorefrontCart, CartCookieItem } from "@/modules/storefront/service";
import { AddToCartSchema, UpdateCartItemSchema } from "@/lib/validators";

const CART_COOKIE_NAME = "drophub_cart";

function parseCartCookie(cookieHeader: string | undefined | null): CartCookieItem[] {
  if (!cookieHeader) return [];
  try {
    const decoded = decodeURIComponent(cookieHeader);
    const parsed = JSON.parse(decoded);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeCartCookie(items: CartCookieItem[]): string {
  return encodeURIComponent(JSON.stringify(items));
}

export async function GET(req: NextRequest) {
  try {
    const cookieValue = req.cookies.get(CART_COOKIE_NAME)?.value;
    const cookieItems = parseCartCookie(cookieValue);
    const cart = await getStorefrontCart(cookieItems);

    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error: any) {
    console.error("[CART_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao consultar carrinho." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = AddToCartSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados do item inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { productId, variantId, quantity } = parseResult.data;
    const cookieValue = req.cookies.get(CART_COOKIE_NAME)?.value;
    const items = parseCartCookie(cookieValue);

    // Encontrar se já existe o mesmo produto/variante
    const existingIndex = items.findIndex(
      (it) => it.productId === productId && (it.variantId || null) === (variantId || null)
    );

    if (existingIndex > -1) {
      items[existingIndex].quantity = Math.min(99, items[existingIndex].quantity + quantity);
    } else {
      items.push({ productId, variantId: variantId || null, quantity });
    }

    const cart = await getStorefrontCart(items);

    const response = NextResponse.json({
      success: true,
      message: "Produto adicionado ao carrinho.",
      cart,
    });

    response.cookies.set(CART_COOKIE_NAME, serializeCartCookie(items), {
      httpOnly: false, // Legível pelo client para persistência rápida
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 dias
    });

    return response;
  } catch (error: any) {
    console.error("[CART_POST_ERROR]", error);
    return NextResponse.json({ error: "Erro ao adicionar item ao carrinho." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = UpdateCartItemSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados do item inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { productId, variantId, quantity } = parseResult.data;
    const cookieValue = req.cookies.get(CART_COOKIE_NAME)?.value;
    let items = parseCartCookie(cookieValue);

    if (quantity <= 0) {
      items = items.filter(
        (it) => !(it.productId === productId && (it.variantId || null) === (variantId || null))
      );
    } else {
      const target = items.find(
        (it) => it.productId === productId && (it.variantId || null) === (variantId || null)
      );
      if (target) {
        target.quantity = quantity;
      }
    }

    const cart = await getStorefrontCart(items);

    const response = NextResponse.json({
      success: true,
      message: "Carrinho atualizado.",
      cart,
    });

    response.cookies.set(CART_COOKIE_NAME, serializeCartCookie(items), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error: any) {
    console.error("[CART_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Erro ao atualizar carrinho." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const variantId = searchParams.get("variantId") || null;
    const clearAll = searchParams.get("clear") === "true";

    let items: CartCookieItem[] = [];

    if (!clearAll && productId) {
      const cookieValue = req.cookies.get(CART_COOKIE_NAME)?.value;
      const currentItems = parseCartCookie(cookieValue);
      items = currentItems.filter(
        (it) => !(it.productId === productId && (it.variantId || null) === (variantId || null))
      );
    }

    const cart = await getStorefrontCart(items);

    const response = NextResponse.json({
      success: true,
      message: clearAll ? "Carrinho esvaziado." : "Item removido do carrinho.",
      cart,
    });

    if (clearAll) {
      response.cookies.delete(CART_COOKIE_NAME);
    } else {
      response.cookies.set(CART_COOKIE_NAME, serializeCartCookie(items), {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error: any) {
    console.error("[CART_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao remover item do carrinho." }, { status: 500 });
  }
}
