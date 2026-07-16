import { renderOrderConfirmationEmail } from "@/lib/order-email";

export const dynamic = "force-dynamic";

// Preview do e-mail de confirmação com dados de exemplo. Só pra conferir o
// design no navegador — usa dados fixos fake, não toca em nada real.
export async function GET() {
  const { html } = renderOrderConfirmationEmail({
    orderCode: "GG-8F3A2K",
    customer: { name: "João Silva", email: "joao@email.com", phone: "(91) 99999-8888" },
    address: {
      cep: "68650-000",
      street: "Rua das Palmeiras",
      number: "128",
      complement: "Casa 2",
      neighborhood: "Centro",
      city: "Belém",
      stateUF: "PA",
    },
    items: [
      { id: 1, name: "Kit Churrasco Personalizado Churrasqueiro Oficial da Família", image: "/images/produtos/wb-kit-churrasco-personalizado-churrasqueiro-oficial-da-familia-1.png", price: 40.52, quantity: 1 },
      { id: 2, name: "Espeto Tridente Giratório Inox 67,5cm", image: "/images/produtos/ig-espeto-tridente-giratorio-inox-67-5cm.jpg", price: 6.98, quantity: 2 },
    ],
    subtotal: 54.48,
    shipping: 0,
    discount: 2.72,
    coupon: "PRIMEIRACOMPRA",
    total: 51.76,
    paymentMethod: "pix",
  });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
