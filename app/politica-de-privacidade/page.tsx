import { Header } from "@/components/store/header"
import { Footer } from "@/components/store/footer"

export const metadata = {
  title: "Política de Privacidade | Gold Grill",
  description: "Saiba como a Gold Grill coleta, usa e protege seus dados pessoais em conformidade com a LGPD.",
}

export default function PoliticaDePrivacidadePage() {
  return (
    <main className="min-h-screen bg-[#ffffff]">
      <Header />
      <div className="h-14" />

      <section className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b98a2e]">
          Institucional
        </p>
        <h1 className="mt-3 text-2xl font-bold leading-tight text-[#1a1a1a] md:text-4xl">
          Política de Privacidade
        </h1>
        <p className="mt-3 text-sm text-[#737373]">Última atualização: maio de 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-[#525252] md:text-base">

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">1. Identificação do Controlador</h2>
            <p className="mt-2">
              Esta Política de Privacidade é aplicada pela marca <strong>Gold Grill</strong>, operada por{" "}
              <strong>NOVA ERA COMERCIAL LTDA</strong>, inscrita no CNPJ{" "}
              <strong>66.889.994/0001-57</strong>, com sede em São Paulo — SP — Brasil.
            </p>
            <p className="mt-2">
              Contato do encarregado de dados (DPO):{" "}
              <a href="mailto:atendimento-pedidos@goldgrill.shop" className="text-[#b98a2e] underline">
                atendimento-pedidos@goldgrill.shop
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">2. Informações Coletadas</h2>
            <p className="mt-2">
              Coletamos apenas os dados estritamente necessários para a prestação dos nossos serviços:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Nome completo e CPF (para emissão de nota fiscal)</li>
              <li>Endereço de entrega completo com CEP</li>
              <li>E-mail e telefone (para comunicação sobre o pedido)</li>
              <li>Dados de pagamento — processados por parceiros certificados PCI-DSS (nunca armazenamos dados de cartão)</li>
              <li>Dados de navegação anônimos (cookies, endereço IP, dispositivo) para melhorar a experiência de compra</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">3. Finalidade do Tratamento</h2>
            <p className="mt-2">Seus dados são utilizados exclusivamente para:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Processar e confirmar pedidos</li>
              <li>Calcular frete e coordenar a entrega</li>
              <li>Enviar atualizações sobre o status do pedido</li>
              <li>Responder solicitações de suporte</li>
              <li>Cumprir obrigações fiscais e legais (LGPD, Código do Consumidor)</li>
              <li>Prevenir fraudes e garantir a segurança da plataforma</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">4. Compartilhamento de Dados</h2>
            <p className="mt-2">
              Compartilhamos seus dados apenas com terceiros necessários à operação, sempre sob acordo de confidencialidade e dentro da mesma finalidade:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Gateway de pagamento</strong> (Pagou.ai) — para processar transações com segurança</li>
              <li><strong>Transportadoras e Correios</strong> — para entrega dos produtos</li>
              <li><strong>Plataformas de rastreio</strong> — para atualização do status de entrega</li>
            </ul>
            <p className="mt-2">
              Nunca vendemos, alugamos ou comercializamos seus dados pessoais com terceiros para fins de marketing.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">5. Cookies e Rastreamento</h2>
            <p className="mt-2">
              Utilizamos cookies próprios e funcionais para manter recursos essenciais do site e melhorar a experiência de navegação. Você pode gerenciar seus cookies pelo banner exibido no primeiro acesso ao site.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">6. Retenção dos Dados</h2>
            <p className="mt-2">
              Os dados de compra são retidos pelo prazo legal mínimo de 5 anos para cumprimento de obrigações fiscais. Dados de contato e navegação são retidos por até 2 anos ou até que você solicite a exclusão.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">7. Seus Direitos (LGPD — Lei 13.709/2018)</h2>
            <p className="mt-2">Em conformidade com a Lei Geral de Proteção de Dados, você tem direito a:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Confirmar a existência de tratamento dos seus dados</li>
              <li>Acessar os dados que possuímos sobre você</li>
              <li>Corrigir dados incorretos ou incompletos</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Revogar o consentimento a qualquer momento</li>
              <li>Portabilidade dos seus dados a outro fornecedor</li>
            </ul>
            <p className="mt-2">
              Para exercer qualquer um desses direitos, entre em contato pelo e-mail{" "}
              <a href="mailto:atendimento-pedidos@goldgrill.shop" className="text-[#b98a2e] underline">
                atendimento-pedidos@goldgrill.shop
              </a>.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">8. Segurança</h2>
            <p className="mt-2">
              Adotamos medidas técnicas e organizacionais para proteger seus dados contra acessos não autorizados, alteração, divulgação ou destruição, incluindo criptografia HTTPS em todas as transmissões de dados.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#1a1a1a]">9. Alterações desta Política</h2>
            <p className="mt-2">
              Podemos atualizar esta política periodicamente. Qualquer alteração relevante será comunicada por e-mail ou por aviso destacado no site. A data de "última atualização" no topo desta página indica quando a versão atual entrou em vigor.
            </p>
          </div>

          <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-4">
            <p className="text-xs text-[#737373]">
              <strong className="text-[#1a1a1a]">Responsável pelo tratamento de dados:</strong><br />
              NOVA ERA COMERCIAL LTDA — CNPJ 66.889.994/0001-57<br />
              Rua Santa Cruz, 2187 — Caixa Postal 11433, Sala 09 — Vila Mariana — São Paulo/SP — CEP 04.121-002<br />
              atendimento-pedidos@goldgrill.shop
            </p>
          </div>

        </div>
      </section>

      <Footer />
    </main>
  )
}
