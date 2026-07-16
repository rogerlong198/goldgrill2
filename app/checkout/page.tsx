"use client";

import React, { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { Lock, CreditCard, ShieldCheck, Mail, Trash2, ShoppingBag, X, Copy, PackageCheck, Upload, FileCheck2, Truck, TicketPercent, Flame } from 'lucide-react';

// Escassez: mesmo cálculo da PDP (hash do slug) — o "restam X" tem que bater
// entre página de produto e checkout, senão o cliente percebe a inconsistência.
function stockLeftFor(slug: string) {
  let h = 0
  for (const ch of slug || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return 3 + (h % 9) // 3..11
}
import { motion, AnimatePresence } from 'framer-motion';
import { PixIcon, MastercardIcon, VisaIcon, EloIcon } from '@/components/store/payment-icons';
import { ReputationSeals } from '@/components/store/reputation-seals';
import { useCart, COUPON_CODE } from '@/lib/cart-context';

const ORDER_LOOKUP_STORAGE_KEY = 'fio-nobre-order-lookup-v1';

// Snapshot da tela de "Pedido Confirmado" — persistido para sobreviver a reload
// ou à pessoa sair da aba e voltar (senão ela perde o código de rastreio).
const CONFIRMED_ORDER_STORAGE_KEY = 'fio-nobre-confirmed-order-v1';

type ConfirmedOrder = {
  orderCode: string;
  customerName: string;
  email: string;
  paymentMethod: 'pix' | 'card';
  total: number;
  installments: number;
  confirmedAt: string;
};

function persistConfirmedOrder(snapshot: ConfirmedOrder) {
  try {
    window.localStorage.setItem(CONFIRMED_ORDER_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // A tela ao vivo continua funcionando mesmo se o navegador bloquear storage.
  }
}

function readConfirmedOrder(): ConfirmedOrder | null {
  try {
    const raw = window.localStorage.getItem(CONFIRMED_ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConfirmedOrder;
    if (!parsed?.orderCode) return null;
    // Expira após 7 dias para não "sequestrar" o checkout indefinidamente caso
    // a pessoa nunca clique em fechar.
    if (parsed.confirmedAt) {
      const ageMs = Date.now() - new Date(parsed.confirmedAt).getTime();
      if (Number.isFinite(ageMs) && ageMs > 7 * 24 * 60 * 60 * 1000) {
        clearConfirmedOrder();
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearConfirmedOrder() {
  try {
    window.localStorage.removeItem(CONFIRMED_ORDER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Google Ads — conversao de compra (conta Gold Grill)
const GOOGLE_ADS_CONVERSION_SEND_TO = 'AW-18197200459/gyTWCO_dpbocEMv8jOVD';
const GOOGLE_ADS_CONVERSION_STORAGE_KEY = 'fio-nobre-google-ads-conversions-v1';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// Dispara a conversao SO quando o pagamento foi confirmado. Usa o transaction_id
// (codigo do pedido) + localStorage para nunca contar a mesma venda 2x.
function sendGoogleAdsPurchaseConversion(transactionId: string, value: number) {
  if (typeof window === 'undefined' || !transactionId) return;
  try {
    const raw = window.localStorage.getItem(GOOGLE_ADS_CONVERSION_STORAGE_KEY);
    const tracked = raw ? JSON.parse(raw) : [];
    const trackedIds = Array.isArray(tracked) ? tracked : [];
    if (trackedIds.includes(transactionId)) return;

    if (typeof window.gtag !== 'function') {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        window.dataLayer?.push(arguments);
      };
    }

    window.gtag('event', 'conversion', {
      send_to: GOOGLE_ADS_CONVERSION_SEND_TO,
      value: Number(value.toFixed(2)),
      currency: 'BRL',
      transaction_id: transactionId,
    });

    window.localStorage.setItem(
      GOOGLE_ADS_CONVERSION_STORAGE_KEY,
      JSON.stringify([transactionId, ...trackedIds].slice(0, 50)),
    );
  } catch (error) {
    console.error('[GOOGLE ADS] Falha ao enviar conversao de compra:', error);
  }
}

type PixProof = {
  name: string;
  size: number;
  type: string;
  attachedAt: string;
};

type ShippingOptionId = 'free' | 'express';

const SHIPPING_OPTIONS: Array<{
  id: ShippingOptionId;
  name: string;
  eta: string;
  price: number;
  description: string;
}> = [
  {
    id: 'free',
    name: 'Frete grátis',
    eta: '7 dias',
    price: 0,
    description: 'Entrega econômica para todo o Brasil.',
  },
  {
    id: 'express',
    name: 'Frete expresso',
    eta: 'Entrega prioritária',
    price: 14.9,
    description: 'Envio mais rápido com separação prioritária.',
  },
];

function randomOrderLetters(length: number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  return Array.from({ length }, () => {
    return alphabet[Math.floor(Math.random() * alphabet.length)];
  }).join('');
}

function buildOrderCode(source: string) {
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(31, hash) + source.charCodeAt(index);
    hash |= 0;
  }

  const prefix = randomOrderLetters(2);
  const numberSeed = Math.abs(hash + Date.now());
  const number = String(numberSeed % 1000000000).padStart(9, '0');
  const suffix = randomOrderLetters(2);

  return `${prefix}${number}${suffix}`;
}

function buildDestinationAddress(address: {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  stateUF: string;
}) {
  const streetLine = [address.street.trim(), address.number.trim()].filter(Boolean).join(', ');
  const fullStreetLine = [streetLine, address.complement.trim()].filter(Boolean).join(' - ');
  const cityState = [address.city.trim(), address.stateUF.trim().toUpperCase()].filter(Boolean).join(' - ');
  const regionLine = [address.neighborhood.trim(), cityState].filter(Boolean).join(', ');
  const cepLine = address.cep.trim() ? `CEP ${address.cep.trim()}` : '';

  return [fullStreetLine, regionLine, cepLine].filter(Boolean).join(' - ');
}

function saveOrderLookup(order: {
  code: string;
  name: string;
  email: string;
  phone: string;
  destinationAddress: string;
  address: {
    cep: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    stateUF: string;
  };
}) {
  try {
    const raw = window.localStorage.getItem(ORDER_LOOKUP_STORAGE_KEY);
    const current = raw ? JSON.parse(raw) : [];
    const orders = Array.isArray(current) ? current : [];
    const nextOrders = [
      {
        ...order,
        savedAt: new Date().toISOString(),
      },
      ...orders.filter((item: any) => item?.code !== order.code),
    ].slice(0, 10);

    window.localStorage.setItem(ORDER_LOOKUP_STORAGE_KEY, JSON.stringify(nextOrders));
  } catch {
    // O rastreio continua funcionando pelo codigo mesmo se o navegador bloquear storage.
  }
}

function savePixProofLookup(code: string, proof: PixProof) {
  try {
    const raw = window.localStorage.getItem(ORDER_LOOKUP_STORAGE_KEY);
    const current = raw ? JSON.parse(raw) : [];
    const orders = Array.isArray(current) ? current : [];
    const nextOrders = orders.map((item: any) => {
      if (item?.code !== code) return item;
      return {
        ...item,
        pixProof: proof,
      };
    });

    window.localStorage.setItem(ORDER_LOOKUP_STORAGE_KEY, JSON.stringify(nextOrders));
  } catch {
    // O comprovante e opcional; o fluxo de pagamento nao depende desse anexo.
  }
}

function formatProofSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function CheckoutContent() {
  const { items, totalPrice, couponApplied, couponCode, couponPct, couponDiscount, applyCoupon, removeCoupon, removeItem, updateQuantity, clearCart } = useCart();

  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const handleApplyCoupon = () => {
    if (couponInput.trim().toUpperCase() === COUPON_CODE) {
      applyCoupon();
      setCouponInput("");
      setCouponError("");
    } else {
      setCouponError("Cupom inválido ou expirado.");
    }
  };

  const [isMounted, setIsMounted] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  // Espelha paymentConfirmed numa ref para as armadilhas de saída lerem o valor
  // atual sem precisar entrar na dep array (a declaração do estado vem depois).
  const paymentConfirmedRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Intercepta fechamento da aba ou refresh — mas NÃO depois do pedido pago.
  useEffect(() => {
    if (!isMounted) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (paymentConfirmedRef.current) return; // compra concluída: não prende
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isMounted]);

  // Armadilha para o botão voltar do celular/navegador
  useEffect(() => {
    if (!isMounted) return;

    // Empurra um estado extra para amortecer o "Voltar"
    window.history.pushState({ trap: true }, '');

    const handlePopState = () => {
      // Pedido já pago: deixa o cliente navegar livremente.
      if (paymentConfirmedRef.current) return;
      // Quando tenta voltar, em vez de sair da página, exibe o popup
      setShowExitWarning(true);
      // E repõe a armadilha
      window.history.pushState({ trap: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMounted]);

  // Estados
  const [payMethod, setPayMethod] = useState<'pix' | 'card'>('pix');
  const [currentStep, setCurrentStep] = useState(1);
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [shippingOptionId, setShippingOptionId] = useState<ShippingOptionId>('free');

  // PIX State
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string, qrCodeImage: string | null, expiresAt?: string, txid?: string | null } | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixProof, setPixProof] = useState<PixProof | null>(null);
  const [pixProofError, setPixProofError] = useState<string | null>(null);

  // Card State (Payment Element SDK v3 — tokenização no browser)
  const [cardInstallments, setCardInstallments] = useState('1');
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const [cardResult, setCardResult] = useState<{ approved: boolean; message: string } | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [pagouElements, setPagouElements] = useState<any>(null);
  const [cardSdkReady, setCardSdkReady] = useState(false);
  const [cardSdkError, setCardSdkError] = useState<string | null>(null);

  // Thank You screen state
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [orderCode, setOrderCode] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);
  const purchaseConversionSentRef = useRef(false);
  // Código do pedido gerado no servidor (no /api/pix/create) e reaproveitado
  // na confirmação, para casar com o e-mail disparado pelo webhook.
  const pendingOrderCodeRef = useRef<string>('');

  const selectedShipping = SHIPPING_OPTIONS.find((option) => option.id === shippingOptionId) ?? SHIPPING_OPTIONS[0];
  const shippingPrice = selectedShipping.price;
  // O cupom (cart-context) desconta AQUI — deste valor derivam o resumo, o
  // parcelamento, a conversão do Google Ads e o valor cobrado no gateway.
  const checkoutTotal = Math.max(0, totalPrice - couponDiscount) + shippingPrice;

  // Conversao de compra (Google Ads) — dispara apenas quando o pagamento foi
  // confirmado, enviando o valor real e o id unico do pedido.
  useEffect(() => {
    if (!paymentConfirmed || !orderCode || purchaseConversionSentRef.current) return;
    purchaseConversionSentRef.current = true;
    sendGoogleAdsPurchaseConversion(orderCode, checkoutTotal);
  }, [paymentConfirmed, orderCode, checkoutTotal]);

  // Mantém a ref espelhada com o estado (lida pelas armadilhas de saída).
  useEffect(() => {
    paymentConfirmedRef.current = paymentConfirmed;
  }, [paymentConfirmed]);

  // Restaura a tela de "Pedido Confirmado" quando a pessoa recarrega ou sai da
  // aba e volta — assim ela não perde o código de rastreio. Não reescreve
  // `orderCode` de propósito, para a conversão do Google Ads não disparar 2x.
  useEffect(() => {
    const saved = readConfirmedOrder();
    if (saved) {
      setConfirmedOrder(saved);
      setPaymentConfirmed(true);
    }
  }, []);

  // Pagou.ai Payment Element SDK v3 — carrega script e monta o card element
  // quando o usuário escolhe pagamento por cartão.
  useEffect(() => {
    if (payMethod !== 'card') return;
    if (cardSdkReady) return;

    const PAGOU_SCRIPT = 'https://js.pagou.ai/payments/v3.js';
    let cancelled = false;

    let retryTimer: any = null;
    let retries = 0;

    const init = () => {
      if (cancelled) return;
      const PagouSDK = (window as any).Pagou;
      if (!PagouSDK) {
        setCardSdkError('SDK Pagou.ai não carregou.');
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_PAGOUAI_PUBLIC_KEY;
      if (!publicKey) {
        setCardSdkError('Chave pública da Pagou.ai não configurada.');
        return;
      }
      // A div #pagou-card-element está dentro de AnimatePresence e pode ainda
      // não ter sido montada no DOM no primeiro tick. Espera até aparecer.
      const target = document.getElementById('pagou-card-element');
      if (!target) {
        if (retries++ < 40) {
          retryTimer = setTimeout(init, 50);
        } else {
          setCardSdkError('Container do cartão não foi montado a tempo.');
        }
        return;
      }
      try {
        console.log('[Pagou SDK] mounting card element (try)');
        // Sempre limpa o container antes de montar — se sobrar um iframe
        // morto de mount anterior o SDK não desenha em cima.
        target.innerHTML = '';

        if (typeof PagouSDK.setEnvironment === 'function') {
          PagouSDK.setEnvironment(publicKey.startsWith('pk_test_') ? 'sandbox' : 'production');
        }
        const elements = PagouSDK.elements({
          publicKey,
          locale: 'pt',
          origin: window.location.origin,
        });
        const card = elements.create('card', { theme: 'default' });
        card.mount(target);
        console.log('[Pagou SDK] card element mounted ok');
        setPagouElements(elements);
        setCardSdkReady(true);
        setCardSdkError(null);
      } catch (err: any) {
        console.error('[Pagou SDK] mount failed:', err);
        setCardSdkError(err?.message || 'Falha ao iniciar formulário de cartão.');
      }
    };

    const existing = document.querySelector(`script[src="${PAGOU_SCRIPT}"]`) as HTMLScriptElement | null;
    if (existing && (window as any).Pagou) {
      init();
    } else if (existing) {
      existing.addEventListener('load', init, { once: true });
    } else {
      const script = document.createElement('script');
      script.src = PAGOU_SCRIPT;
      script.async = true;
      script.onload = init;
      script.onerror = () => setCardSdkError('Falha ao carregar SDK de pagamento.');
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [payMethod, cardSdkReady, currentStep]);

  // Quando o usuário sai de "Cartão", o React desmonta o <div #pagou-card-element>
  // mas o state cardSdkReady continua true — aí, voltando pra Cartão, o useEffect
  // acima não re-roda e o iframe não remonta. Aqui resetamos pra forçar remount.
  // Também limpamos o container no DOM (caso algum iframe morto fique pra trás).
  useEffect(() => {
    if (payMethod !== 'card' && (cardSdkReady || pagouElements)) {
      console.log('[Pagou SDK] payMethod left card — resetting');
      setPagouElements(null);
      setCardSdkReady(false);
      setCardSdkError(null);
      const container = document.getElementById('pagou-card-element');
      if (container) container.innerHTML = '';
    }
  }, [payMethod, cardSdkReady, pagouElements]);

  // Address State
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [stateUF, setStateUF] = useState('');
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  // Validation State
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState('');

  const getInputClass = (field: string) => {
    const base = "w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:outline-none transition-all ";
    return base + (errors[field] ? "border-red-500 focus:ring-2 focus:ring-red-500/30" : "border-gray-200 focus:ring-2 focus:ring-[#b98a2e]/30 focus:border-[#b98a2e]");
  };

  const sendOrderConfirmationEmail = useCallback(
    async (code: string, method: 'pix' | 'card', txid?: string | null) => {
      if (!email || items.length === 0) return;
      try {
        await fetch('/api/email/order-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderCode: code,
            // Coordena a idempotência com o webhook (mesma chave por txid).
            txid: txid ?? undefined,
            customer: {
              name: name.trim(),
              email: email.trim(),
              phone: phone.replace(/\D/g, ''),
              cpf: cpf.replace(/\D/g, ''),
            },
            address: {
              cep: cep.trim(),
              street: street.trim(),
              number: number.trim(),
              complement: complement.trim() || undefined,
              neighborhood: neighborhood.trim(),
              city: city.trim(),
              stateUF: stateUF.trim().toUpperCase(),
            },
            items: items.map((item) => ({
              id: item.id,
              name: item.name,
              image: item.image,
              price: item.price,
              compareAtPrice: item.compareAtPrice,
              quantity: item.quantity,
            })),
            subtotal: totalPrice,
            shipping: shippingPrice,
            discount: couponDiscount,
            coupon: couponApplied ? couponCode : undefined,
            total: checkoutTotal,
            paymentMethod: method,
          }),
        });
      } catch (err) {
        // E-mail é "best effort" — falha não bloqueia a confirmação.
        console.error('[ORDER EMAIL] Falha ao despachar:', err);
      }
    },
    [
      cep, city, complement, cpf, email, items, name, neighborhood, number,
      phone, shippingPrice, stateUF, street, totalPrice, checkoutTotal,
      couponApplied, couponCode, couponDiscount,
    ],
  );

  // Fecha/dispensa a tela de "Pedido Confirmado": apaga o snapshot persistido,
  // esvazia o carrinho (a compra terminou) e volta para a loja.
  const handleCloseConfirmation = useCallback(() => {
    clearConfirmedOrder();
    clearCart();
    setConfirmedOrder(null);
    setPaymentConfirmed(false);
    paymentConfirmedRef.current = false;
    setPixData(null);
    setOrderCode('');
    pendingOrderCodeRef.current = '';
    window.location.href = '/';
  }, [clearCart]);

  const issueOrderCode = useCallback((source: string) => {
    const code = buildOrderCode(source);
    setOrderCode(code);
    saveOrderLookup({
      code,
      name: name.trim(),
      email: email.trim(),
      phone,
      destinationAddress: buildDestinationAddress({
        cep,
        street,
        number,
        complement,
        neighborhood,
        city,
        stateUF,
      }),
      address: {
        cep: cep.trim(),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        stateUF: stateUF.trim().toUpperCase(),
      },
    });
    if (pixProof) savePixProofLookup(code, pixProof);
    return code;
  }, [cep, city, complement, email, name, neighborhood, number, phone, pixProof, stateUF, street]);

  const createCheckoutSession = useCallback(async () => {
    const res = await fetch('/api/checkout/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((item) => ({
          id: item.id,
          slug: item.slug,
          quantity: item.quantity,
        })),
        // O server recalcula o total (subtotal - cupom + frete) e assina ESSE
        // valor — pra a sessão bater com o total cobrado no PIX/cartão.
        coupon: couponApplied,
        shippingCents: Math.round(shippingPrice * 100),
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || 'Nao foi possivel validar o checkout.');
    }
  }, [items, couponApplied, shippingPrice]);

  const triggerError = (newErrors: Record<string, boolean>) => {
    setErrors(newErrors);
    setFormError('Preencha os campos obrigatórios');
    setTimeout(() => {
      setFormError('');
      setErrors({});
    }, 5000);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    if (value.length > 10) value = `${value.slice(0, 10)}-${value.slice(10)}`;
    setPhone(value);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 3) value = `${value.slice(0, 3)}.${value.slice(3)}`;
    if (value.length > 7) value = `${value.slice(0, 7)}.${value.slice(7)}`;
    if (value.length > 11) value = `${value.slice(0, 11)}-${value.slice(11)}`;
    setCpf(value);
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    if (value.length > 5) value = `${value.slice(0, 5)}-${value.slice(5)}`;
    setCep(value);

    const rawCep = value.replace(/\D/g, '');
    if (rawCep.length === 8) {
      setIsFetchingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setStreet(data.logradouro || '');
          setNeighborhood(data.bairro || '');
          setCity(data.localidade || '');
          setStateUF(data.uf || '');
        }
      } catch (error) {
        console.error("Erro ao buscar CEP", error);
      } finally {
        setIsFetchingCep(false);
      }
    }
  };
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');

  const handlePixSubmit = async () => {
    setPixError(null);
    setPixProofError(null);
    setIsGeneratingPix(true);
    
    try {
      await createCheckoutSession();

      const res = await fetch('/api/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: checkoutTotal,
          phone,
          cpf,
          name,
          email,
          title: "Combo Enxoval",
          // Pedido completo persistido no servidor (KV) para o webhook
          // conseguir disparar o e-mail mesmo com a aba fechada.
          order: {
            address: {
              cep: cep.trim(),
              street: street.trim(),
              number: number.trim(),
              complement: complement.trim() || undefined,
              neighborhood: neighborhood.trim(),
              city: city.trim(),
              stateUF: stateUF.trim().toUpperCase(),
            },
            items: items.map((item) => ({
              id: item.id,
              name: item.name,
              image: item.image,
              price: item.price,
              compareAtPrice: item.compareAtPrice,
              quantity: item.quantity,
            })),
            subtotal: totalPrice,
            shipping: shippingPrice,
            discount: couponDiscount,
            coupon: couponApplied ? couponCode : undefined,
          },
        })
      });

      const data = await res.json();

      if (!res.ok) {
        const gatewayHint = data?.gateway
          ? ` | gateway: ${typeof data.gateway === 'string' ? data.gateway : JSON.stringify(data.gateway)}`
          : '';
        console.error('[PIX][gateway response]', data);
        throw new Error((data?.error || data?.detail || 'Erro ao gerar PIX') + gatewayHint);
      }

      setPixData({
        qrCode: data.qrCode,
        qrCodeImage: data.qrCodeImage,
        expiresAt: data.expiresAt,
        txid: data.txid ?? null,
      });

      // Código do pedido gerado no servidor: guarda para a confirmação e já
      // popula o lookup do rastreio (localStorage) com o MESMO código, para o
      // link do e-mail (disparado pelo webhook) bater com o rastreio local.
      if (data.orderCode) {
        pendingOrderCodeRef.current = data.orderCode;
        saveOrderLookup({
          code: data.orderCode,
          name: name.trim(),
          email: email.trim(),
          phone,
          destinationAddress: buildDestinationAddress({
            cep,
            street,
            number,
            complement,
            neighborhood,
            city,
            stateUF,
          }),
          address: {
            cep: cep.trim(),
            street: street.trim(),
            number: number.trim(),
            complement: complement.trim(),
            neighborhood: neighborhood.trim(),
            city: city.trim(),
            stateUF: stateUF.trim().toUpperCase(),
          },
        });
      }

      setTimeout(() => {
        document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (err: any) {
      setPixError(err.message);
    } finally {
      setIsGeneratingPix(false);
    }
  };

  useEffect(() => {
    if (!pixData?.txid || paymentConfirmed || orderCode) return;

    let stopped = false;

    const checkPixPayment = async () => {
      try {
        const response = await fetch(`/api/payment/status?txid=${encodeURIComponent(pixData.txid || '')}`, {
          cache: 'no-store',
        });
        const data = await response.json().catch(() => null);

        if (!stopped && response.ok && data?.paid) {
          // Usa o código gerado no servidor (devolvido na criação do PIX). Só
          // gera localmente como fallback caso ele não tenha vindo.
          const code =
            pendingOrderCodeRef.current ||
            issueOrderCode(pixData.txid || `${email}|${cpf}|pix|paid|${Date.now()}`);
          if (pendingOrderCodeRef.current) {
            setOrderCode(code);
            if (pixProof) savePixProofLookup(code, pixProof);
          }
          // Snapshot persistido: a tela de confirmação sobrevive a reload / sair
          // e voltar da aba, preservando o código de rastreio.
          const snapshot: ConfirmedOrder = {
            orderCode: code,
            customerName: name,
            email,
            paymentMethod: 'pix',
            total: checkoutTotal,
            installments: 1,
            confirmedAt: new Date().toISOString(),
          };
          setConfirmedOrder(snapshot);
          persistConfirmedOrder(snapshot);
          setPaymentConfirmed(true);
          // Rede de segurança (Camada 1): o webhook é a fonte primária do
          // e-mail; isto cobre o caso de a notificação do gateway não chegar.
          // A trava por txid no servidor garante um único envio.
          void sendOrderConfirmationEmail(code, 'pix', pixData.txid);
        }
      } catch {
        // O PIX continua aguardando a confirmacao do gateway.
      }
    };

    checkPixPayment();
    const interval = window.setInterval(checkPixPayment, 5000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [cpf, email, issueOrderCode, orderCode, paymentConfirmed, pixData?.txid]);

  const handleCopyPix = () => {
    if (pixData?.qrCode) {
      navigator.clipboard.writeText(pixData.qrCode);
      alert('Código PIX copiado!');
    }
  };

  const handlePixProofChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPixProofError(null);

    if (!file) return;

    const isAllowedType = file.type.startsWith('image/') || file.type === 'application/pdf';
    const maxSize = 10 * 1024 * 1024;

    if (!isAllowedType) {
      setPixProof(null);
      setPixProofError('Envie uma imagem ou PDF do comprovante.');
      event.target.value = '';
      return;
    }

    if (file.size > maxSize) {
      setPixProof(null);
      setPixProofError('O arquivo precisa ter no maximo 10 MB.');
      event.target.value = '';
      return;
    }

    const proof = {
      name: file.name,
      size: file.size,
      type: file.type || 'arquivo',
      attachedAt: new Date().toISOString(),
    };

    setPixProof(proof);
    if (orderCode) savePixProofLookup(orderCode, proof);
  };

  // Remonta o Payment Element após uma falha (banco recusa, antifraude, etc).
  // O iframe da Pagou é "consumido" em cada submit() — sem remount, a próxima
  // tentativa joga "CardElement is not mounted".
  const resetPagouCardElement = useCallback(() => {
    setPagouElements(null);
    setCardSdkReady(false);
    setCardSdkError(null);
    const container = document.getElementById('pagou-card-element');
    if (container) container.innerHTML = '';
  }, []);

  const handleFinalCardStatus = (status: string, transaction?: any) => {
    const approved = ['paid', 'captured', 'succeeded', 'completed', 'authorized', 'approved'].includes(status);
    const message = approved
      ? 'Pagamento aprovado! ✅'
      : status === 'requires_action' || status === 'three_ds_required'
      ? 'Autenticação 3D Secure necessária — siga as instruções do seu banco.'
      : status === 'failed' || status === 'refused' || status === 'canceled'
      ? 'Cartão recusado ou bloqueado pelo seu banco. Libere a compra no app do banco e tente novamente.'
      : 'Pagamento em análise.';
    setCardResult({ approved, message });
    if (approved) {
      const code = issueOrderCode(transaction?.id || `${email}|${cpf}|card|paid|${Date.now()}`);
      void sendOrderConfirmationEmail(code, 'card', transaction?.id ?? null);
      const snapshot: ConfirmedOrder = {
        orderCode: code,
        customerName: name,
        email,
        paymentMethod: 'card',
        total: checkoutTotal,
        installments: parseInt(cardInstallments) || 1,
        confirmedAt: new Date().toISOString(),
      };
      setConfirmedOrder(snapshot);
      persistConfirmedOrder(snapshot);
      setTimeout(() => setPaymentConfirmed(true), 1500);
    } else if (!approved) {
      // Falha definitiva — remonta o card pra próxima tentativa.
      resetPagouCardElement();
    }
  };

  const handleCardSubmit = async () => {
    setCardError(null);
    setCardResult(null);

    if (cardSdkError) {
      setCardError(cardSdkError);
      return;
    }
    if (!pagouElements || !cardSdkReady) {
      setCardError('Formulário de cartão ainda não carregou. Aguarde alguns segundos e tente novamente.');
      return;
    }

    setIsProcessingCard(true);
    try {
      await createCheckoutSession();

      const browserInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language || 'pt-BR',
        colorDepth: window.screen.colorDepth,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        timezoneOffset: new Date().getTimezoneOffset(),
        javaEnabled: false,
        javascriptEnabled: true,
      };
      const address = {
        zip_code: cep.replace(/\D/g, ''),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim() || undefined,
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: stateUF.trim().toUpperCase(),
        country: 'BR',
      };

      let backendResponse: any = null;

      const submitResult = await pagouElements.submit({
        createTransaction: async (tokenData: any) => {
          const res = await fetch('/api/card/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              value: checkoutTotal,
              name,
              email,
              cpf,
              phone,
              installments: parseInt(cardInstallments) || 1,
              title: 'Combo Enxoval',
              token: tokenData?.token,
              address,
              browser: browserInfo,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            const gatewayHint = data?.gateway
              ? ` | gateway: ${typeof data.gateway === 'string' ? data.gateway : JSON.stringify(data.gateway)}`
              : '';
            console.error('[CARD][gateway response]', data);
            throw new Error((data?.error || data?.detail || 'Erro ao processar cartão') + gatewayHint);
          }
          backendResponse = data;
          // Devolve o objeto da transaction (com next_action) pro SDK
          // disparar o modal 3DS automaticamente quando aplicável.
          return data?.transaction ?? data;
        },
      });

      console.log('[CARD][submitResult]', submitResult);

      // Após o submit (incluindo eventual 3DS resolvido pelo SDK), o status
      // final pode vir em submitResult.transaction.status, submitResult.status
      // ou no que o backend devolveu inicialmente.
      const finalStatus =
        submitResult?.transaction?.status ??
        submitResult?.status ??
        backendResponse?.status ??
        'unknown';

      // Quando o SDK precisa de ação adicional manual, tentamos handleNextAction
      // como fallback (alguns fluxos não disparam o modal sozinhos).
      if ((finalStatus === 'requires_action' || finalStatus === 'three_ds_required') &&
          (window as any).Pagou?.handleNextAction &&
          (submitResult?.next_action || submitResult?.transaction?.next_action || backendResponse?.next_action)) {
        try {
          const nextAction =
            submitResult?.transaction?.next_action ??
            submitResult?.next_action ??
            backendResponse?.next_action;
          const afterAction = await (window as any).Pagou.handleNextAction(nextAction);
          console.log('[CARD][handleNextAction result]', afterAction);
          const postStatus =
            afterAction?.transaction?.status ?? afterAction?.status ?? finalStatus;
          handleFinalCardStatus(postStatus, afterAction?.transaction ?? backendResponse?.transaction);
          return;
        } catch (err: any) {
          console.error('[CARD][handleNextAction error]', err);
          setCardError(err?.message || 'Autenticação 3D Secure falhou.');
          return;
        }
      }

      if (finalStatus === 'error') {
        setCardError(submitResult?.error || 'Falha ao processar pagamento.');
      } else {
        handleFinalCardStatus(finalStatus, submitResult?.transaction ?? backendResponse?.transaction);
      }
    } catch (err: any) {
      console.error('[CARD]', err);
      setCardError(err?.message || 'Erro inesperado. Tente novamente.');
      // Remonta o card element pra o usuário tentar de novo sem refresh.
      resetPagouCardElement();
    } finally {
      setIsProcessingCard(false);
    }
  };

  // Permite ao usuário forçar um novo formulário de cartão depois de
  // exibir uma mensagem de erro/recusa, sem precisar atualizar a página.
  const retryCardForm = useCallback(() => {
    setCardError(null);
    setCardResult(null);
    resetPagouCardElement();
  }, [resetPagouCardElement]);


  const handleNextToStep2 = () => {
    const newErrors: Record<string, boolean> = {};
    if (!name.trim()) newErrors.name = true;
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = true;
    if (cpf.replace(/\D/g, '').length !== 11) newErrors.cpf = true;
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) newErrors.phone = true;
    
    if (Object.keys(newErrors).length > 0) {
      triggerError(newErrors);
      return;
    }
    
    setErrors({});
    setFormError('');
    setCurrentStep(2);
  };

  const handleNextToStep3 = () => {
    const newErrors: Record<string, boolean> = {};
    if (cep.replace(/\D/g, '').length !== 8) newErrors.cep = true;
    if (!street.trim()) newErrors.street = true;
    if (!number.trim()) newErrors.number = true;
    if (!neighborhood.trim()) newErrors.neighborhood = true;
    if (!city.trim()) newErrors.city = true;
    if (!stateUF.trim()) newErrors.stateUF = true;
    
    if (Object.keys(newErrors).length > 0) {
      triggerError(newErrors);
      return;
    }
    
    setErrors({});
    setFormError('');
    setCurrentStep(3);
  };

  if (!isMounted) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-gray-500 font-bold">Carregando checkout...</div>;
  }

  if (items.length === 0 && !pixData && !paymentConfirmed) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Seu carrinho está vazio</h2>
        <p className="text-gray-500 mb-6">Adicione produtos para finalizar sua compra.</p>
        <a href="/" className="gold-flow text-[#1a1a1a] font-bold px-8 py-3 rounded-full uppercase tracking-wider">Voltar para a loja</a>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // TELA DE OBRIGADO — exibida após pagamento confirmado
  // ═══════════════════════════════════════════════════════════════
  if (paymentConfirmed) {
    // Usa o snapshot persistido (sobrevive a reload / sair e voltar da aba). Cai
    // nos estados ao vivo só como fallback do fluxo recém-confirmado.
    const display: ConfirmedOrder = confirmedOrder ?? {
      orderCode,
      customerName: name,
      email,
      paymentMethod: payMethod,
      total: checkoutTotal,
      installments: parseInt(cardInstallments) || 1,
      confirmedAt: '',
    };
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 max-w-lg w-full text-center relative overflow-hidden"
        >
          {/* Barra dourada no topo */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#b98a2e] via-[#ff9a52] to-[#b98a2e]" />

          {/* Botão de fechar — dispensa a tela persistente e volta para a loja */}
          <button
            type="button"
            onClick={handleCloseConfirmation}
            aria-label="Fechar"
            className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-800"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Ícone de sucesso animado */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 12 }}
            className="w-24 h-24 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center"
          >
            <motion.svg
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="w-12 h-12 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                d="M5 13l4 4L19 7"
              />
            </motion.svg>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-3xl sm:text-4xl font-black text-gray-900 mb-2 tracking-tight"
          >
            Pedido Confirmado!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="text-gray-500 font-medium mb-8 text-sm sm:text-base"
          >
            Obrigado pela sua compra, <span className="text-gray-800 font-bold">{(display.customerName || '').split(' ')[0]}</span>! 🎉
          </motion.p>

          {display.orderCode && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.72 }}
              className="bg-[#1a1a1a] rounded-2xl p-5 mb-6 text-left shadow-lg"
            >
              <div className="flex items-start gap-3">
                <PackageCheck className="w-5 h-5 text-[#b98a2e] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-black">Código do pedido</p>
                  <p className="mt-2 text-2xl font-black tracking-wide text-white break-words">{display.orderCode}</p>
                  <p className="mt-2 text-xs leading-relaxed text-white/70">
                    Use este código para acompanhar o andamento do pedido depois da compra.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(display.orderCode)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black uppercase tracking-wide text-[#1a1a1a] transition hover:bg-[#f3ead8]"
              >
                <Copy className="w-4 h-4" />
                Copiar código
              </button>
            </motion.div>
          )}

          {/* Detalhes do pedido */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-gray-50 rounded-2xl p-5 mb-6 text-left space-y-3"
          >
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">Método</span>
              <span className="font-bold text-gray-800 flex items-center gap-1.5">
                {display.paymentMethod === 'pix' ? (
                  <><PixIcon className="w-4 h-4" /> PIX</>
                ) : (
                  <><CreditCard className="w-4 h-4" /> Cartão de Crédito</>
                )}
              </span>
            </div>
            <div className="border-t border-gray-200" />
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">Total pago</span>
              <span className="font-black text-emerald-600 text-lg">
                R$ {display.total.toFixed(2).replace('.', ',')}
              </span>
            </div>
            {display.paymentMethod === 'card' && display.installments > 1 && (
              <>
                <div className="border-t border-gray-200" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Parcelas</span>
                  <span className="font-bold text-gray-800">
                    {display.installments}x de R$ {(display.total / display.installments).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </>
            )}
            <div className="border-t border-gray-200" />
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">E-mail</span>
              <span className="font-bold text-gray-800 text-xs">{display.email}</span>
            </div>
          </motion.div>

          {/* Mensagem de envio */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95 }}
            className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-start gap-3"
          >
            <Mail className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-800 font-medium text-left leading-relaxed">
              Enviamos a confirmação para <strong>{display.email}</strong>. O código acima acompanha o pedido na Gold Grill; o rastreio da transportadora será enviado quando o pedido for despachado.
            </p>
          </motion.div>

          {/* Garantia */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05 }}
            className="flex items-center justify-center gap-2 text-xs text-gray-400 font-bold mb-8"
          >
            <ShieldCheck className="w-4 h-4" />
            Garantia de Satisfação Gold Grill
          </motion.div>

          {/* Botão voltar para loja */}
          {display.orderCode && (
            <motion.a
              href={`/rastreio-de-pedido?codigo=${encodeURIComponent(display.orderCode)}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.12 }}
              className="mb-3 inline-block w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-black text-sm uppercase tracking-wide shadow-lg transition-all hover:-translate-y-0.5"
            >
              Acompanhar Pedido
            </motion.a>
          )}

          <motion.button
            type="button"
            onClick={handleCloseConfirmation}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="inline-block w-full py-4 bg-gradient-to-r from-[#f8cc46] to-[#eaa50c] hover:brightness-105 text-[#1a1a1a] rounded-xl font-black text-sm uppercase tracking-wide shadow-lg shadow-[#5b4126]/30 transition-all hover:-translate-y-0.5"
          >
            Continuar Comprando
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {/* Modal de Exit Intent */}
      <AnimatePresence>
        {showExitWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#1a1a1a]/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-6 sm:p-8 pt-8 sm:pt-10 max-w-md w-full shadow-2xl relative text-center border-4 border-[#b98a2e]"
            >
              <button 
                onClick={() => setShowExitWarning(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 transition-colors"
                aria-label="Fechar aviso"
              >
                <X size={24} />
              </button>
              
              <h2 className="text-3xl font-black text-gray-900 mb-2 uppercase tracking-tight">Espera aí!</h2>
              <p className="text-gray-600 font-medium mb-6 text-sm sm:text-base leading-relaxed">
                Você está a um passo de garantir seus produtos com <strong className="text-[#22c55e]">Envio Prioritário</strong>. Tem certeza que deseja abandonar seu carrinho e perder a reserva?
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => setShowExitWarning(false)}
                  className="w-full bg-[#22c55e] text-white font-black py-4 rounded-xl shadow-[0_4px_20px_rgba(34,197,94,0.3)] hover:-translate-y-1 hover:shadow-[0_6px_25px_rgba(34,197,94,0.4)] transition-all uppercase tracking-widest"
                >
                  Continuar Finalizando
                </button>
                <button 
                  onClick={() => {
                    window.history.back();
                    window.history.back();
                  }}
                  className="w-full bg-gray-100 text-gray-500 font-bold py-3.5 rounded-xl hover:bg-gray-200 transition-all uppercase tracking-wider text-xs"
                >
                  Quero perder meus itens
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-gray-50 text-gray-900 pb-12">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/images/logo-gold-grill.png" alt="Gold Grill" className="h-8 object-contain" />
          <span className="text-[10px] text-[#b98a2e] tracking-widest uppercase font-semibold">Checkout</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs sm:text-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Pagamento 100% seguro
        </div>
      </div>

      {/* Timer Bar */}
      <div className="gold-flow text-[#1a1a1a] text-center py-2.5 font-bold text-sm shadow-md">
        ⏰ Oferta expira em <strong className="font-black tabular-nums tracking-wider">{minutes}:{seconds}</strong> — finalize seu pedido agora
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto mt-6 px-4 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
        
        {/* Esquerda: Formulários */}
        <div className="space-y-4">
          
          {/* Sessão 1: Dados Pessoais */}
          <motion.div layout className={`bg-white border rounded-2xl p-6 shadow-sm transition-all duration-300 ${currentStep === 1 ? 'border-[#b98a2e] ring-1 ring-[#b98a2e]' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs ${currentStep >= 1 ? 'bg-[#b98a2e]' : 'bg-gray-300'}`}>1</span>
                Identificação
              </h2>
              {currentStep > 1 && (
                <button onClick={() => setCurrentStep(1)} className="text-[#b98a2e] text-xs font-bold hover:underline">Editar</button>
              )}
            </div>
            
            <AnimatePresence mode="wait">
            {currentStep === 1 ? (
              <motion.div 
                key="step1-open"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Nome completo</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className={getInputClass('name')} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">E-mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className={getInputClass('email')} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">CPF</label>
                    <input type="text" value={cpf} onChange={handleCpfChange} placeholder="000.000.000-00" className={getInputClass('cpf')} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Celular</label>
                    <input type="tel" value={phone} onChange={handlePhoneChange} placeholder="(00) 00000-0000" className={getInputClass('phone')} />
                  </div>
                </div>
                {formError && <motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-red-500 text-sm font-bold text-center pt-2">{formError}</motion.p>}
                <button onClick={handleNextToStep2} className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#f8cc46] to-[#eaa50c] text-[#1a1a1a] font-bold rounded-xl shadow-lg shadow-[#5b4126]/25 hover:brightness-110 transition-all">
                  Continuar para Entrega
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="step1-closed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-gray-500 font-medium pt-2"
              >
                Dados preenchidos ✓
              </motion.div>
            )}
            </AnimatePresence>
          </motion.div>

          {/* Sessão 2: Endereço de Entrega */}
          <motion.div layout className={`bg-white border rounded-2xl p-6 shadow-sm transition-all duration-300 ${currentStep === 2 ? 'border-[#b98a2e] ring-1 ring-[#b98a2e]' : 'border-gray-200 opacity-60'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`text-lg font-extrabold flex items-center gap-2 ${currentStep >= 2 ? 'text-gray-800' : 'text-gray-400'}`}>
                <span className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs ${currentStep >= 2 ? 'bg-[#b98a2e]' : 'bg-gray-300'}`}>2</span>
                Endereço de Entrega
              </h2>
              {currentStep > 2 && (
                <button onClick={() => setCurrentStep(2)} className="text-[#b98a2e] text-xs font-bold hover:underline">Editar</button>
              )}
            </div>
            
            <AnimatePresence>
            {currentStep === 2 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">CEP {isFetchingCep && <span className="text-emerald-500 lowercase normal-case">(buscando...)</span>}</label>
                  <input type="text" value={cep} onChange={handleCepChange} placeholder="00000-000" className={`sm:w-1/3 ${getInputClass('cep')}`} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Endereço (Rua, Avenida)</label>
                    <input type="text" value={street} onChange={e => setStreet(e.target.value)} placeholder="Nome da rua" className={getInputClass('street')} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Número</label>
                    <input type="text" value={number} onChange={e => setNumber(e.target.value)} placeholder="Ex: 123" className={getInputClass('number')} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Complemento (opcional)</label>
                    <input type="text" value={complement} onChange={e => setComplement(e.target.value)} placeholder="Apto, Bloco, Casa 2" className={getInputClass('complement')} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Bairro</label>
                    <input type="text" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Nome do bairro" className={getInputClass('neighborhood')} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Cidade</label>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Sua cidade" className={getInputClass('city')} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Estado</label>
                    <input type="text" value={stateUF} onChange={e => setStateUF(e.target.value)} placeholder="UF" className={getInputClass('stateUF')} />
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Opções de frete</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {SHIPPING_OPTIONS.map((option) => {
                      const isSelected = shippingOptionId === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setShippingOptionId(option.id)}
                          className={`rounded-xl border-2 bg-white p-4 text-left transition-all ${
                            isSelected
                              ? 'border-[#b98a2e] shadow-[0_10px_25px_rgba(255,82,82,0.14)]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 text-sm font-black text-gray-900">
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                option.price === 0
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-[#f0d9a8] text-[#5b4126]'
                              }`}>
                                <Truck className="h-4 w-4" />
                              </span>
                              {option.name}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
                              option.price === 0
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-[#f0d9a8] text-[#9a7100]'
                            }`}>
                              {option.price === 0 ? 'Grátis' : `R$ ${option.price.toFixed(2).replace('.', ',')}`}
                            </span>
                          </span>
                          <span className="mt-2 block text-xs font-bold uppercase tracking-wide text-gray-500">{option.eta}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-gray-500">{option.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {formError && <motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-red-500 text-sm font-bold text-center pt-2">{formError}</motion.p>}
                <button onClick={handleNextToStep3} className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#f8cc46] to-[#eaa50c] text-[#1a1a1a] font-bold rounded-xl shadow-lg shadow-[#5b4126]/25 hover:brightness-110 transition-all">
                  Ir para Pagamento
                </button>
              </motion.div>
            )}
            </AnimatePresence>
          </motion.div>
          
          {/* Sessão 3: Pagamento */}
          <motion.div id="payment-section" layout className={`bg-white border rounded-2xl p-6 shadow-sm transition-all duration-300 ${currentStep === 3 ? 'border-[#b98a2e] ring-1 ring-[#b98a2e]' : 'border-gray-200 opacity-50'}`}>
            <h2 className={`text-lg font-extrabold mb-5 flex items-center gap-2 ${currentStep >= 3 ? 'text-gray-800' : 'text-gray-400'}`}>
              <span className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs ${currentStep >= 3 ? 'bg-[#b98a2e]' : 'bg-gray-300'}`}>3</span>
              Forma de pagamento
            </h2>
            
            <AnimatePresence>
            {currentStep === 3 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mb-5">
                  <ReputationSeals />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <button 
                    onClick={() => setPayMethod('pix')}
                    className={`p-4 border-2 rounded-xl flex items-center gap-3 font-extrabold transition-all ${payMethod === 'pix' ? 'border-[#b98a2e] bg-[#b98a2e]/5 text-[#b98a2e]' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                  >
                  <img src="https://icons.yampi.me/svg/card-pix.svg" alt="Pix" width="28" height="20" /> PIX
                  </button>
                  <button 
                    onClick={() => setPayMethod('card')}
                    className={`p-4 border-2 rounded-xl flex items-center gap-3 font-extrabold transition-all ${payMethod === 'card' ? 'border-[#b98a2e] bg-[#b98a2e]/5 text-[#b98a2e]' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                  >
                    <CreditCard className="w-5 h-5" /> Cartão
                  </button>
                </div>

                <AnimatePresence mode="wait">
                {payMethod === 'pix' ? (
                  <motion.div 
                    key="pix"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="bg-gradient-to-b from-[#b98a2e]/5 to-white border border-dashed border-[#b98a2e]/40 rounded-xl p-5 text-center flex flex-col items-center"
                  >
                    {!pixData ? (
                      <>
                        <h3 className="font-bold text-gray-800 mb-1">Pague com PIX e libere envio na hora</h3>
                        <p className="text-sm text-gray-500 mb-4">Aprovação em segundos. Clique no botão abaixo para gerar seu PIX.</p>
                        <div className="flex flex-wrap justify-center gap-3 text-xs font-bold text-emerald-600 mb-2">
                          <span>✓ Aprovação instantânea</span>
                          <span>✓ Sem taxas extras</span>
                          <span>✓ Processamento prioritário</span>
                        </div>
                        {pixError && <div className="mt-2 text-xs text-red-500 font-bold bg-red-50 p-2 rounded w-full">{pixError}</div>}
                      </>
                    ) : (
                      <>
                        <h3 className="font-bold text-emerald-600 mb-2">PIX Gerado com Sucesso!</h3>
                        <div className="mb-3 w-full max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
                          Este QR Code expira em 10 minutos. Pague antes desse prazo para evitar gerar um novo PIX.
                        </div>
                        <div className="w-44 h-44 bg-white border-2 border-emerald-100 rounded-2xl p-3 mx-auto mb-4 shadow-sm relative">
                          <img 
                            src={pixData.qrCodeImage || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=0&data=${encodeURIComponent(pixData.qrCode)}`} 
                            alt="QR Code PIX" 
                            className="w-full h-full object-contain mix-blend-multiply" 
                          />
                        </div>
                        <p className="text-xs text-gray-500 mb-2">Ou copie o código abaixo (PIX Copia e Cola):</p>
                        <div className="flex items-center gap-2 w-full max-w-sm">
                          <input type="text" readOnly value={pixData.qrCode} className="flex-1 bg-white text-gray-700 text-xs p-3 rounded-xl border border-gray-200 font-mono focus:outline-none" />
                          <button onClick={handleCopyPix} className="bg-[#b98a2e] text-white text-xs font-bold px-4 py-3 rounded-xl hover:bg-[#5b4126] transition-colors">COPIAR</button>
                        </div>
                        <div className="mt-4 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f0d9a8] text-[#5b4126]">
                              {pixProof ? <FileCheck2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-500">Comprovante opcional</p>
                              <p className="mt-1 text-xs font-medium leading-relaxed text-gray-500">
                                Se quiser, anexe uma imagem ou PDF do comprovante. A confirmação do PIX continua automática.
                              </p>
                            </div>
                          </div>

                          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#b98a2e]/60 bg-[#f3ead9] px-4 py-3 text-xs font-black uppercase tracking-wide text-[#1a1a1a] transition hover:border-[#b98a2e] hover:bg-[#f0d9a8]">
                            <Upload className="h-4 w-4 text-[#b98a2e]" />
                            {pixProof ? 'Trocar comprovante' : 'Enviar comprovante'}
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="sr-only"
                              onChange={handlePixProofChange}
                            />
                          </label>

                          {pixProof && (
                            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                              Comprovante anexado: <span className="break-words">{pixProof.name}</span>
                              <span className="ml-1 font-semibold text-emerald-600">({formatProofSize(pixProof.size)})</span>
                            </div>
                          )}

                          {pixProofError && (
                            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                              {pixProofError}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="card"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-4"
                  >
                    {cardResult ? (
                      <div className="space-y-3">
                        <div className={`p-4 rounded-xl text-center font-bold text-sm ${
                          cardResult.approved
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : 'bg-red-50 border border-red-200 text-red-600'
                        }`}>
                          {cardResult.approved ? '✅ ' : '❌ '}{cardResult.message}
                        </div>
                        {!cardResult.approved && (
                          <button
                            type="button"
                            onClick={retryCardForm}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#f8cc46] to-[#eaa50c] text-[#1a1a1a] font-bold text-sm hover:brightness-110 transition-all"
                          >
                            Tentar com outro cartão
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                            Dados do cartão
                          </label>
                          <div
                            id="pagou-card-element"
                            className="w-full min-h-[120px] px-3 py-3 border border-gray-200 rounded-xl bg-gray-50 transition-all"
                          />
                          {!cardSdkReady && !cardSdkError && (
                            <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                              <span className="inline-block h-2 w-2 rounded-full bg-[#b98a2e] animate-pulse" />
                              Carregando formulário seguro…
                            </p>
                          )}
                          {cardSdkError && (
                            <p className="mt-2 text-xs text-red-600 font-medium">{cardSdkError}</p>
                          )}
                          <p className="mt-2 text-[11px] text-gray-400 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Dados do cartão criptografados pela Pagou.ai
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Parcelas</label>
                          <select
                            value={cardInstallments}
                            onChange={e => setCardInstallments(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#b98a2e]/30 focus:border-[#b98a2e] transition-all"
                          >
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                              <option key={n} value={n}>{n}x de R$ {(checkoutTotal / n).toFixed(2).replace('.', ',')} {n === 1 ? '(sem juros)' : ''}</option>
                            ))}
                          </select>
                        </div>
                        {cardError && (
                          <div className="space-y-2">
                            <p className="text-red-500 text-sm font-bold text-center">{cardError}</p>
                            <button
                              type="button"
                              onClick={retryCardForm}
                              className="w-full py-2.5 rounded-xl border-2 border-[#b98a2e] text-[#b98a2e] font-bold text-sm hover:bg-[#f0d9a8] transition-colors"
                            >
                              Tentar novamente
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
                </AnimatePresence>

                {pixData && payMethod === 'pix' && !paymentConfirmed && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-5 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left"
                  >
                    <p className="text-xs font-bold leading-relaxed text-amber-800">
                      O código do pedido será liberado automaticamente depois que o pagamento for confirmado.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Direita: Resumo do Pedido */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm lg:sticky lg:top-24">
            <h2 className="text-lg font-extrabold text-gray-800 mb-5">Resumo do pedido</h2>
            
            <div className="space-y-4 pb-5 border-b border-gray-100 mb-5 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-contain p-1" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <strong className="block text-gray-800 font-bold leading-tight text-xs truncate">{item.name}</strong>
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-red-500">
                      <Flame size={10} className="fill-red-500" />
                      Últimas {stockLeftFor(item.slug)} unidades — reservado por tempo limitado
                    </span>
                    <div className="flex items-center justify-between mt-1.5">
                      {/* Quantity controls */}
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors font-bold text-base"
                        >−</button>
                        <span className="w-7 text-center text-xs font-bold text-gray-800">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors font-bold text-base"
                        >+</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                          aria-label="Remover item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2.5 mb-5">
              <div className="flex justify-between text-sm text-gray-500 font-medium">
                <span>Subtotal</span>
                <span>R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
              </div>
              {couponApplied ? (
                <div className="flex justify-between items-center rounded-lg bg-[#f0d9a8]/50 px-2.5 py-1.5 text-xs font-bold text-[#5b4126]">
                  <span className="flex items-center gap-1.5">
                    <TicketPercent size={14} />
                    Cupom {couponCode} (-{couponPct}%)
                  </span>
                  <span className="flex items-center gap-2">
                    <span>-R$ {couponDiscount.toFixed(2).replace('.', ',')}</span>
                    <button
                      onClick={removeCoupon}
                      className="rounded-full p-0.5 text-[#5b4126]/60 transition-colors hover:bg-[#5b4126]/10 hover:text-[#5b4126]"
                      aria-label="Remover cupom"
                    >
                      <X size={13} />
                    </button>
                  </span>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value); setCouponError("") }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApplyCoupon() } }}
                      placeholder="Cupom de desconto"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 text-xs font-semibold uppercase tracking-wide text-gray-800 outline-none placeholder:normal-case placeholder:font-normal placeholder:text-gray-400 focus:border-[#b98a2e]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={!couponInput.trim()}
                      className="h-9 shrink-0 rounded-lg bg-gradient-to-r from-[#f8cc46] to-[#eaa50c] px-4 text-xs font-black uppercase tracking-wide text-[#1a1a1a] transition-all hover:brightness-105 disabled:opacity-50"
                    >
                      Aplicar
                    </button>
                  </div>
                  {couponError && (
                    <p className="mt-1 text-[11px] font-semibold text-red-500">{couponError}</p>
                  )}
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-500">
                <span>Frete</span>
                <span className={shippingPrice === 0 ? 'text-emerald-600' : 'text-gray-800'}>
                  {shippingPrice === 0 ? 'Grátis' : `R$ ${shippingPrice.toFixed(2).replace('.', ',')}`}
                </span>
              </div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-gray-400">
                <span>{selectedShipping.name}</span>
                <span>{selectedShipping.eta}</span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between items-baseline text-gray-800 font-black">
                <span>Total</span>
                <span className="text-lg">R$ {checkoutTotal.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            <button 
              onClick={() => {
                if (payMethod === 'pix') handlePixSubmit();
                else if (payMethod === 'card') handleCardSubmit();
              }}
              disabled={
                isGeneratingPix || isProcessingCard ||
                (payMethod === 'pix' && !!pixData) ||
                (payMethod === 'card' && !!cardResult?.approved)
              }
              className="w-full py-4 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-400 text-white rounded-xl font-black text-sm uppercase tracking-wide shadow-lg transition-all hover:-translate-y-0.5"
            >
              {isGeneratingPix
                ? "GERANDO PIX..."
                : isProcessingCard
                ? "PROCESSANDO CARTÃO..."
                : payMethod === 'pix' && pixData
                ? "AGUARDANDO PAGAMENTO..."
                : payMethod === 'card' && cardResult?.approved
                ? "PAGAMENTO APROVADO ✓"
                : "Concluir Pagamento"}
            </button>

            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs font-bold text-emerald-800">
              <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
              Ambiente de pagamento 100% seguro e criptografado.
            </div>

            {/* Payment Icons */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-5 pt-4 border-t border-gray-100">
              <img src="https://icons.yampi.me/svg/card-amex.svg" alt="Amex" width="32" height="22" />
              <img src="https://icons.yampi.me/svg/card-visa.svg" alt="Visa" width="32" height="22" />
              <img src="https://icons.yampi.me/svg/card-diners.svg" alt="Diners" width="32" height="22" />
              <img src="https://icons.yampi.me/svg/card-mastercard.svg" alt="Mastercard" width="32" height="22" />
              <img src="https://icons.yampi.me/svg/card-discover.svg" alt="Discover" width="32" height="22" />
              <img src="https://icons.yampi.me/svg/card-aura.svg" alt="Aura" width="32" height="22" />
              <img src="https://icons.yampi.me/svg/card-elo.svg" alt="Elo" width="32" height="22" />
              <img src="https://icons.yampi.me/svg/card-hiper.svg" alt="Hiper" width="32" height="22" />
              <img src="https://icons.yampi.me/svg/card-pix.svg" alt="Pix" width="32" height="22" />
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-gray-500">Iniciando checkout seguro...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
