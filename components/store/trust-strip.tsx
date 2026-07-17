"use client"

import { useEffect, useState } from "react"
import { PackageCheck, RefreshCw, Truck } from "lucide-react"

const TRUST_ITEMS = [
  {
    title: "+2 milhões de pedidos",
    description: "entregues no Brasil",
    Icon: PackageCheck,
  },
  {
    title: "Frete grátis",
    description: "para todo o Brasil",
    Icon: Truck,
  },
  {
    title: "30 dias de troca",
    description: "garantida",
    Icon: RefreshCw,
  },
]

function TrustItem({ item }: { item: (typeof TRUST_ITEMS)[number] }) {
  const Icon = item.Icon

  return (
    <div className="flex items-center justify-center gap-3">
      <Icon className="h-8 w-8 shrink-0 stroke-[1.8] text-[#b98a2e]" />
      <p className="text-sm font-semibold leading-tight text-[#1a1a1a]">
        <span className="block text-[#5b4126]">{item.title}</span>
        {item.description}
      </p>
    </div>
  )
}

export function TrustStrip() {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % TRUST_ITEMS.length)
    }, 5000)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="border-b border-[#f0d9a8] bg-[#ffffff]">
      <div className="h-1 w-full bg-gradient-to-r from-[#b98a2e] via-[#f0d9a8] to-[#5b4126]" />

      <div className="mx-auto max-w-5xl px-4 py-5 md:py-6">
        <div className="md:hidden">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {TRUST_ITEMS.map((item) => (
                <div key={item.title} className="w-full shrink-0 px-2">
                  <TrustItem item={item} />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            {TRUST_ITEMS.map((item, index) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Mostrar benefício ${index + 1}`}
                onClick={() => setActiveIndex(index)}
                className={`h-2.5 rounded-full transition-all ${
                  activeIndex === index
                    ? "w-6 bg-[#b98a2e]"
                    : "w-2.5 bg-[#f0d9a8]"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="hidden grid-cols-3 gap-8 md:grid">
          {TRUST_ITEMS.map((item) => (
            <TrustItem key={item.title} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}
