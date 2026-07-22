import { notFound } from "next/navigation"
import { Header } from "@/components/store/header"
import { Footer } from "@/components/store/footer"
import { ProductPage } from "@/components/store/product-page"
import { PageTransition } from "@/components/store/page-transition"
import { getProductBySlug, getProductsByCategory, getVariantSiblings, getSizeSiblings, products } from "@/lib/products"
import { applyOverlay, applyOverlayOne } from "@/lib/catalog-runtime"
import { stripHtmlToText } from "@/lib/rich-text"
import type { Metadata } from "next"

interface PageProps {
  params: Promise<{ slug: string }>
}

// ISR: rede de segurança pra edição do painel chegar no site mesmo se o
// revalidatePath on-demand falhar. Sem isto a página fica estática do build.
export const revalidate = 300

export async function generateStaticParams() {
  return products.map((product) => ({
    slug: product.slug,
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await applyOverlayOne(getProductBySlug(slug))

  if (!product) {
    return { title: "Produto não encontrado | Gold Grill" }
  }

  return {
    title: `${product.name} | Gold Grill`,
    description: stripHtmlToText(product.description).slice(0, 160),
  }
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params
  const product = await applyOverlayOne(getProductBySlug(slug))

  if (!product) {
    notFound()
  }

  const relatedProducts = (await applyOverlay(getProductsByCategory(product.category)))
    .filter((p) => p.id !== product.id)
    .slice(0, 4)

  return (
    <main className="min-h-screen bg-[#ffffff]">
      <Header />

      {/* Spacer for fixed header */}
      <div className="h-14" />

      <PageTransition>
        <ProductPage
          product={product}
          relatedProducts={relatedProducts}
          variantSiblings={getVariantSiblings(slug)}
          sizeSiblings={getSizeSiblings(slug)}
        />
      </PageTransition>

      <Footer />
    </main>
  )
}
