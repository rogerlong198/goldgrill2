import { Header } from "@/components/store/header"
import { Footer } from "@/components/store/footer"
import { Mail, Instagram } from "lucide-react"

export const metadata = {
  title: "Contato e Catálogo | Gold Grill",
  description: "Entre em contato com a Gold Grill. Tire dúvidas, solicite o catálogo completo e fale com nossa equipe.",
}

export default function ContatoECatalogoPage() {
  return (
    <main className="min-h-screen bg-[#ffffff]">
      <Header />
      <div className="h-14" />

      <section className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b98a2e]">
          Fale Conosco
        </p>
        <h1 className="mt-3 text-2xl font-bold leading-tight text-[#1a1a1a] md:text-4xl">
          Contato e Catálogo
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#525252] md:text-base">
          Estamos aqui para ajudar. Se você tem dúvidas sobre produtos, pedidos, prazos de entrega
          ou quer solicitar nosso catálogo completo, escolha o canal mais conveniente para você.
        </p>

        {/* Contact Cards */}
        <div className="mt-10 space-y-4">

          {/* E-mail */}
          <div className="flex items-start gap-4 rounded-lg border border-[#e5e5e5] p-5 hover:border-[#b98a2e] transition-colors">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fdf6e3]">
              <Mail size={18} className="text-[#b98a2e]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1a1a1a]">E-mail</p>
              <p className="mt-1 text-sm text-[#737373]">
                Para pedidos, trocas, dúvidas gerais e solicitação de catálogo.
              </p>
              <a
                href="mailto:atendimento-pedidos@goldgrill.shop"
                className="mt-2 inline-block text-sm font-medium text-[#b98a2e] underline"
              >
                atendimento-pedidos@goldgrill.shop
              </a>
              <p className="mt-1 text-xs text-[#b0b0b0]">Respondemos em até 24h úteis</p>
            </div>
          </div>


          {/* Instagram */}
          <div className="flex items-start gap-4 rounded-lg border border-[#e5e5e5] p-5 hover:border-[#b98a2e] transition-colors">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fdf6e3]">
              <Instagram size={18} className="text-[#b98a2e]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1a1a1a]">Instagram</p>
              <p className="mt-1 text-sm text-[#737373]">
                Acompanhe novidades, lançamentos e inspire-se com nossas decorações.
              </p>
              <a
                href="https://instagram.com/goldgrill"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-medium text-[#b98a2e] underline"
              >
                @goldgrill
              </a>
            </div>
          </div>

        </div>

        {/* Catalog Request */}
        <div className="mt-10">
          <h2 className="text-base font-bold text-[#1a1a1a]">Solicitar Catálogo Completo</h2>
          <p className="mt-2 text-sm leading-7 text-[#525252]">
            Quer conhecer toda a nossa linha de produtos? Envie um e-mail para{" "}
            <a href="mailto:atendimento-pedidos@goldgrill.shop" className="text-[#b98a2e] underline">
              atendimento-pedidos@goldgrill.shop
            </a>{" "}
            com o assunto <strong>"Solicitar Catálogo"</strong> e nossa equipe enviará o PDF completo
            com todas as coleções, referências e tabela de preços para revenda.
          </p>
        </div>

        {/* Company Info */}
        <div className="mt-10 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#737373]">
            Dados da Empresa
          </p>
          <div className="mt-3 space-y-1 text-sm text-[#525252]">
            <p><strong className="text-[#1a1a1a]">Marca:</strong> Gold Grill</p>
            <p>
              <strong className="text-[#1a1a1a]">Razão Social:</strong> NOVA ERA COMERCIAL LTDA
            </p>
            <p><strong className="text-[#1a1a1a]">CNPJ:</strong> 66.889.994/0001-57</p>
            <p><strong className="text-[#1a1a1a]">Endereço:</strong> Rua Santa Cruz, 2187 — Caixa Postal 11433, Sala 09 — Vila Mariana — São Paulo/SP — CEP 04.121-002</p>
            <p>
              <strong className="text-[#1a1a1a]">E-mail:</strong>{" "}
              <a href="mailto:atendimento-pedidos@goldgrill.shop" className="text-[#b98a2e] underline">
                atendimento-pedidos@goldgrill.shop
              </a>
            </p>
          </div>
        </div>

      </section>

      <Footer />
    </main>
  )
}
