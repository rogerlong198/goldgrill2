"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Mail } from "lucide-react"
import { ReputationSeals } from "./reputation-seals"

const PAYMENT_ICONS = [
  { alt: "Amex", src: "https://icons.yampi.me/svg/card-amex.svg" },
  { alt: "Visa", src: "https://icons.yampi.me/svg/card-visa.svg" },
  { alt: "Diners", src: "https://icons.yampi.me/svg/card-diners.svg" },
  { alt: "Mastercard", src: "https://icons.yampi.me/svg/card-mastercard.svg" },
  { alt: "Discover", src: "https://icons.yampi.me/svg/card-discover.svg" },
  { alt: "Aura", src: "https://icons.yampi.me/svg/card-aura.svg" },
  { alt: "Elo", src: "https://icons.yampi.me/svg/card-elo.svg" },
  { alt: "Hiper", src: "https://icons.yampi.me/svg/card-hiper.svg" },
  { alt: "Pix", src: "https://icons.yampi.me/svg/card-pix.svg" },
]

interface FooterAccordionProps {
  title: string
  children: React.ReactNode
}

function FooterAccordion({ title, children }: FooterAccordionProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border-b border-[#e5e5e5]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-4"
      >
        <span className="text-sm font-medium text-[#1a1a1a]">{title}</span>
        <ChevronDown
          size={18}
          className={`text-[#737373] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {children}
        </div>
      )}
    </div>
  )
}

export function Footer() {
  return (
    <footer className="bg-[#ffffff] border-t border-[#e5e5e5]">

      {/* Sessão 1 — Sobre a Empresa */}
      <FooterAccordion title="Gold Grill">
        <p className="text-sm text-[#737373] leading-relaxed">
          Tudo para o churrasco perfeito. Curadoria premium em churrasqueiras, facas,
          tábuas, espetos e kits de presente com foco em qualidade e durabilidade.
        </p>
      </FooterAccordion>

      {/* Sessão 2 — Dados Fiscais */}
      <FooterAccordion title="EMPRESA">
        <p className="text-sm text-[#737373] leading-relaxed">
          Marca operada por NOVA ERA COMERCIAL LTDA
        </p>
        <p className="text-sm text-[#737373]">
          <span className="font-medium text-[#1a1a1a]">CNPJ:</span> 66.889.994/0001-57
        </p>
        <p className="text-sm text-[#737373]">
          <span className="font-medium text-[#1a1a1a]">Endereço:</span> Rua Santa Cruz, 2187 — Caixa Postal 11433, Sala 09 — Vila Mariana — São Paulo/SP — CEP 04.121-002
        </p>
      </FooterAccordion>

      {/* Sessão 3 — Institucional */}
      <FooterAccordion title="INSTITUCIONAL">
        <Link href="/politica-de-privacidade" className="text-sm text-[#737373] hover:text-[#1a1a1a] transition-colors">
          Política de Privacidade
        </Link>
        <Link href="/termos-de-uso" className="text-sm text-[#737373] hover:text-[#1a1a1a] transition-colors">
          Termos de Uso
        </Link>
        <Link href="/trocas-e-devolucoes" className="text-sm text-[#737373] hover:text-[#1a1a1a] transition-colors">
          Trocas e Devoluções
        </Link>
        <Link href="/contato-e-catalogo" className="text-sm text-[#737373] hover:text-[#1a1a1a] transition-colors">
          Contato e Catálogo
        </Link>
        <a
          href="mailto:atendimento-pedidos@goldgrill.shop"
          className="text-sm text-[#737373] hover:text-[#1a1a1a] transition-colors inline-flex items-center gap-2"
        >
          <Mail size={14} />
          atendimento-pedidos@goldgrill.shop
        </a>
      </FooterAccordion>

      {/* Sessão 4 — Formas de pagamento */}
      <FooterAccordion title="FORMAS DE PAGAMENTO">
        <p className="text-xs text-[#737373] leading-relaxed">
          Aceitamos Pix e cartões de crédito das principais bandeiras.
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {PAYMENT_ICONS.map((icon) => (
            <img
              key={icon.alt}
              src={icon.src}
              alt={icon.alt}
              width={32}
              height={22}
              loading="lazy"
            />
          ))}
        </div>
      </FooterAccordion>

      {/* Dos selos pra baixo: fundo escuro */}
      <div className="bg-[#1a1a1a] text-white">
        <div className="px-4 py-6">
          <ReputationSeals />
        </div>

        {/* Copyright */}
        <div className="px-4 pt-6 pb-6 border-t border-white/10 flex flex-col items-center gap-1 text-center">
          <p className="text-[11px] text-white/50 uppercase tracking-wide">
            © 2026 GOLD GRILL. TODOS OS DIREITOS RESERVADOS.
          </p>
          <p className="text-[11px] text-white/30 uppercase tracking-wide">
            CHURRASCO PREMIUM &amp; PRESENTES
          </p>
        </div>
      </div>
    </footer>
  )
}
