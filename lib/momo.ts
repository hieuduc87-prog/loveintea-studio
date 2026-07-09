// MoMo Payment Gateway API wrapper
// https://developers.momo.vn/v3/docs/payment/api/wallet/onetime
import crypto from 'crypto';
import { safeEqual } from './crypto';

function getMomoCfg() {
  return {
    partnerCode: process.env.MOMO_PARTNER_CODE || '',
    accessKey:   process.env.MOMO_ACCESS_KEY   || '',
    secretKey:   process.env['MOMO_SECRET_KEY']  || '',
    apiUrl:      process.env.MOMO_API_URL || 'https://test-payment.momo.vn/v2/gateway/api',
  };
}

function assertConfig() {
  const c = getMomoCfg();
  if (!c.partnerCode || !c.accessKey || !c.secretKey) {
    throw new Error('Chưa cấu hình MoMo. Set MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY trong .env');
  }
}

export interface MoMoCreateParams {
  orderId: string;
  amount: number;     // VND
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
  extraData?: string; // base64-encoded JSON
}

export interface MoMoCreateResult {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  responseTime: number;
  message: string;
  resultCode: number;
  payUrl: string;
  qrCodeUrl: string;
  deeplink: string;
}

export async function createMoMoPayment(p: MoMoCreateParams): Promise<MoMoCreateResult> {
  assertConfig();
  const c           = getMomoCfg();
  const requestType = 'captureWallet';
  const requestId   = p.orderId;
  const extraData   = p.extraData || '';

  const rawSig = `accessKey=${c.accessKey}&amount=${p.amount}&extraData=${extraData}&ipnUrl=${p.ipnUrl}&orderId=${p.orderId}&orderInfo=${p.orderInfo}&partnerCode=${c.partnerCode}&redirectUrl=${p.redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
  const signature = crypto.createHmac('sha256', c.secretKey).update(rawSig).digest('hex');

  const body = {
    partnerCode: c.partnerCode,
    partnerName: 'LoveinTea Studio',
    storeId:     'LoveinTeaStudio',
    requestId,
    amount:      p.amount,
    orderId:     p.orderId,
    orderInfo:   p.orderInfo,
    redirectUrl: p.redirectUrl,
    ipnUrl:      p.ipnUrl,
    lang:        'vi',
    requestType,
    autoCapture: true,
    extraData,
    signature,
  };

  const res = await fetch(`${c.apiUrl}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  return res.json();
}

export function verifyMoMoSignature(params: Record<string, string>): boolean {
  assertConfig();
  const c = getMomoCfg();
  const rawSig = `accessKey=${c.accessKey}&amount=${params.amount}&extraData=${params.extraData}&message=${params.message}&orderId=${params.orderId}&orderInfo=${params.orderInfo}&orderType=${params.orderType}&partnerCode=${params.partnerCode}&payType=${params.payType}&requestId=${params.requestId}&responseTime=${params.responseTime}&resultCode=${params.resultCode}&transId=${params.transId}`;
  const sig = crypto.createHmac('sha256', c.secretKey).update(rawSig).digest('hex');
  return safeEqual(sig, params.signature);
}
