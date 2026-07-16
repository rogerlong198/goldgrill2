import { Header } from "@/components/store/header"
import { Footer } from "@/components/store/footer"
import { CollectionProducts } from "@/components/store/collection-products"
import { products } from "@/lib/products"
import { applyOverlay } from "@/lib/catalog-runtime"

export const metadata = {
  title: "Todos os Produtos | Gold Grill",
  description: "Veja todos os produtos disponíveis na Gold Grill.",
}

export default async function ProdutosPage() {
  const serializedProducts = (await applyOverlay(products.filter((p) => !p.isTest))).map((product) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    image: product.image,
    rating: product.rating,
    reviews: product.reviews,
    slug: product.slug,
  }))

  return (
    <main className="min-h-screen bg-[#ffffff]">
      <Header />
      <div className="h-14" />

      <section className="px-4 pt-8 pb-4 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b98a2e]">
          Loja
        </p>
        <h1 className="mt-3 text-2xl font-bold text-[#1a1a1a]">
          Todos os Produtos
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#737373]">
          Explore a seleção completa de churrasco da Gold Grill.
        </p>
      </section>

      <div className="px-4 py-3 border-y border-[#e5e5e5]">
        <p className="text-xs text-[#737373]">
          {serializedProducts.length} produtos
        </p>
      </div>

      <CollectionProducts products={serializedProducts} />

      <Footer />
    </main>
  )
}
