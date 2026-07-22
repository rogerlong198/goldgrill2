"use client"

import { useState } from "react"
import { Package, ShoppingBag, Waypoints, KeyRound, Mail } from "lucide-react"
import type { AdminOrder } from "@/lib/orders"
import type { Catalog } from "@/lib/catalog"
import { LogoutButton } from "./logout-button"
import { OnlineCount } from "./online-count"
import { VisitorsHistory } from "./visitors-history"
import { OrdersPanel } from "./orders-panel"
import { ProductsPanel } from "./products-panel"
import { RelayPanel } from "./relay-panel"
import { SetupStatus } from "./setup-status"
import { EmailDiagPanel } from "./email-diag-panel"

type Modules = { orders: boolean; products: boolean; relay?: boolean }
type Tab = "orders" | "products" | "relay" | "email" | "keys"

export function AdminShell({
  brand,
  modules,
  columns,
  kvOk,
  blobOk,
  orders,
  catalog,
  pending,
  gatewaySwitch,
}: {
  brand: string
  modules: Modules
  columns: Record<string, string>
  kvOk: boolean
  blobOk: boolean
  orders: AdminOrder[]
  catalog: Catalog
  pending: number
  gatewaySwitch?: React.ReactNode
}) {
  const tabs = [
    modules.orders ? ("orders" as const) : null,
    modules.products ? ("products" as const) : null,
    modules.relay ? ("relay" as const) : null,
    "email" as const,
    "keys" as const,
  ].filter(Boolean) as Tab[]

  const [tab, setTab] = useState<Tab>(tabs[0] ?? "orders")

  const pagos = orders.filter((o) => o.status === "pago").length
  const abandonados = orders.filter((o) => o.status === "abandonado").length

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Painel · {brand}</h1>
            {modules.orders && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {orders.length} pedido(s) · {pagos} pago(s) · {abandonados} abandonado(s)
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            {modules.orders && <OnlineCount />}
            <LogoutButton />
          </div>
        </div>

        {modules.orders && <VisitorsHistory />}

        {gatewaySwitch}

        {tabs.length > 1 && (
          <div className="mb-5 flex w-full rounded-xl border border-border bg-card p-1 sm:inline-flex sm:w-auto">
            {modules.orders && (
              <TabButton active={tab === "orders"} onClick={() => setTab("orders")} icon={<ShoppingBag className="h-4 w-4" />}>
                Pedidos
              </TabButton>
            )}
            {modules.products && (
              <TabButton active={tab === "products"} onClick={() => setTab("products")} icon={<Package className="h-4 w-4" />}>
                Produtos
              </TabButton>
            )}
            {modules.relay && (
              <TabButton active={tab === "relay"} onClick={() => setTab("relay")} icon={<Waypoints className="h-4 w-4" />}>
                Relay
              </TabButton>
            )}
            <TabButton active={tab === "email"} onClick={() => setTab("email")} icon={<Mail className="h-4 w-4" />}>
              E-mail
            </TabButton>
            <TabButton active={tab === "keys"} onClick={() => setTab("keys")} icon={<KeyRound className="h-4 w-4" />}>
              Chaves
            </TabButton>
          </div>
        )}

        {tab === "orders" && modules.orders && <OrdersPanel orders={orders} kvOk={kvOk} />}
        {tab === "products" && modules.products && (
          <ProductsPanel initialCatalog={catalog} columns={columns} kvOk={kvOk} blobOk={blobOk} initialPending={pending} />
        )}
        {tab === "relay" && modules.relay && <RelayPanel />}
        {tab === "email" && <EmailDiagPanel />}
        {tab === "keys" && <SetupStatus />}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-colors sm:flex-none ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
