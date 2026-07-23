import { Header } from "@/components/store/header"
import { Footer } from "@/components/store/footer"

export const metadata = {
  title: "Termos de Uso | Gold Grill",
  description: "Leia os Termos de Uso da Gold Grill e saiba as regras para utilização do nosso site e serviços.",
}

export default function TermosDeUsoPage() {
  return (
    <main className="min-h-screen bg-[#ffffff]">
      <Header />
      <div className="h-14" />

      <section className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b98a2e]">
          Institucional
        </p>
        <h1 className="mt-3 text-2xl font-bold leading-tight text-[#1a1a1a] md:text-4xl">
          Termos de Uso
        </h1>
        <p className="mt-3 text-sm text-[#737373]">Última atualização: maio de 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-[#525252] md:text-base">

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">1. Identificação</h2>
            <p className="mt-2">
              Este site é operado pela marca <strong>Gold Grill</strong>, de titularidade de{" "}
              <strong>NOVA ERA COMERCIAL LTDA</strong>, inscrita no CNPJ{" "}
              <strong>66.889.994/0001-57</strong>, com sede em São Paulo — SP — Brasil.
            </p>
            <p className="mt-2">
              Ao acessar e utilizar este site, você declara ter lido, entendido e concordado integralmente com estes Termos de Uso.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">2. Objeto</h2>
            <p className="mt-2">
              A Gold Grill oferece artigos de churrasco (churrasqueiras, facas, tábuas, espetos, kits de presente, jogos de cama, tapetes, almofadas e itens relacionados) por meio deste canal de e-commerce, destinado exclusivamente a consumidores finais (pessoa física) no território brasileiro.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">3. Cadastro e Conta</h2>
            <p className="mt-2">
              Para concluir uma compra, você fornece seus dados diretamente no checkout, sem necessidade de criar uma conta permanente. Você é responsável pela veracidade e atualização de todas as informações fornecidas.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">4. Produtos e Disponibilidade</h2>
            <p className="mt-2">
              Todos os produtos estão sujeitos à disponibilidade de estoque. Imagens são meramente ilustrativas e podem apresentar variações sutis de cor em função do monitor do usuário. Trabalharemos sempre para manter informações de preço e disponibilidade atualizadas; em caso de divergência, o cliente será avisado antes da confirmação do pedido.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">5. Preços e Pagamento</h2>
            <p className="mt-2">
              Os preços são expressos em Reais (BRL) e incluem impostos aplicáveis. Aceitamos pagamento via cartão de crédito (parcelado ou à vista) e PIX. O processamento é realizado por parceiro certificado (Pagou.ai) em ambiente seguro e criptografado. Em caso de recusa de pagamento, o pedido será automaticamente cancelado.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">6. Prazo de Entrega e Frete</h2>
            <p className="mt-2">
              Os prazos de entrega são estimados no momento do checkout com base no CEP de destino. Eventuais atrasos causados por transportadoras, Correios ou situações de força maior não são de responsabilidade da Gold Grill, porém nos comprometemos a comunicar qualquer anormalidade ao cliente e buscar solução.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">7. Direito de Arrependimento</h2>
            <p className="mt-2">
              Em conformidade com o Art. 49 do Código de Defesa do Consumidor (Lei 8.078/1990), compras realizadas pela internet podem ser canceladas em até <strong>7 (sete) dias corridos</strong> a partir do recebimento do produto, sem necessidade de justificativa. O produto deve ser devolvido em sua embalagem original e sem sinais de uso. O estorno será realizado conforme a forma de pagamento original.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">8. Trocas e Devoluções</h2>
            <p className="mt-2">
              Aceitamos trocas em caso de produto com defeito de fabricação, divergência com o produto anunciado ou avaria no transporte. O prazo para comunicar a solicitação é de até 30 dias após o recebimento. Para iniciar o processo, entre em contato pelo e-mail{" "}
              <a href="mailto:atendimento-pedidos@goldgrill.shop" className="text-[#b98a2e] underline">
                atendimento-pedidos@goldgrill.shop
              </a>.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">9. Propriedade Intelectual</h2>
            <p className="mt-2">
              Todo o conteúdo do site — textos, imagens, logotipos, identidade visual e código-fonte — é propriedade exclusiva da Gold Grill / NOVA ERA COMERCIAL LTDA. É proibida qualquer reprodução, distribuição ou uso comercial sem autorização prévia e por escrito.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">10. Limitação de Responsabilidade</h2>
            <p className="mt-2">
              A Gold Grill não se responsabiliza por danos indiretos ou imprevisíveis decorrentes do uso do site ou de atrasos na entrega causados por terceiros. Nosso compromisso é garantir a melhor experiência possível dentro do nosso controle operacional.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">11. Legislação Aplicável e Foro</h2>
            <p className="mt-2">
              Estes Termos de Uso são regidos pelas leis brasileiras, em especial o Código de Defesa do Consumidor (Lei 8.078/1990), o Marco Civil da Internet (Lei 12.965/2014) e a Lei Geral de Proteção de Dados (Lei 13.709/2018). Fica eleito o foro da Comarca de São Paulo — SP para dirimir eventuais controvérsias.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">12. Contato</h2>
            <p className="mt-2">
              Dúvidas sobre estes Termos de Uso? Entre em contato conosco:{" "}
              <a href="mailto:atendimento-pedidos@goldgrill.shop" className="text-[#b98a2e] underline">
                atendimento-pedidos@goldgrill.shop
              </a>
            </p>
          </div>

          <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-4">
            <p className="text-xs text-[#737373]">
              <strong className="text-[#1a1a1a]">Razão Social:</strong> NOVA ERA COMERCIAL LTDA<br />
              <strong className="text-[#1a1a1a]">CNPJ:</strong> 66.889.994/0001-57<br />
              <strong className="text-[#1a1a1a]">Sede:</strong> Rua Santa Cruz, 2187 — Caixa Postal 11433, Sala 09 — Vila Mariana — São Paulo/SP — CEP 04.121-002<br />
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
