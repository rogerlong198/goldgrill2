import type { Metadata, Viewport } from 'next'
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { CartProvider } from '@/lib/cart-context'

// Tipografia da marca: serifada editorial (Fraunces) nos títulos + sans premium
// (Plus Jakarta Sans) no corpo/UI. Carregadas de verdade via next/font (antes o
// site caía no fallback de sistema — Arial/Helvetica).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['opsz'],
})
import { MenuProvider } from '@/lib/menu-context'
import { CartDrawer } from '@/components/store/cart-drawer'
import { CouponPopup } from '@/components/store/coupon-popup'
import { CookieConsent } from '@/components/store/cookie-consent'
import { PresenceBeacon } from '@/components/store/presence-beacon'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gold Grill | Churrasco Premium',
  description: 'O presente perfeito de Dia dos Pais: kits de churrasco, facas artesanais, churrasqueiras e acessórios premium com até 80% OFF.',
  generator: 'v0.app',
  // Favicons servidos pela convenção do Next: app/favicon.ico, app/icon.png,
  // app/apple-icon.png (as tags <link> são geradas automaticamente).
}

export const viewport: Viewport = {
  themeColor: '#b98a2e',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">
        <CartProvider>
          <MenuProvider>
            {children}
            <CartDrawer />
            <CouponPopup />
            <CookieConsent />
            <PresenceBeacon />
          </MenuProvider>
        </CartProvider>
        <Analytics />
      </body>
    </html>
  )
}
