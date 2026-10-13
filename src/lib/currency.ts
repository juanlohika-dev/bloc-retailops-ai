// Fixed demo conversion rates (approximate). Used for normalizing multi-country revenue to USD.
export const USD_RATES: Record<string, number> = {
  USD: 1,
  SGD: 0.74,
  PHP: 0.0175,
  MYR: 0.21,
  THB: 0.028,
  IDR: 0.000062,
  VND: 0.00004,
  JPY: 0.0067,
};

export const COUNTRY_CURRENCY: Record<string, string> = {
  PH: 'PHP', SG: 'SGD', MY: 'MYR', TH: 'THB', ID: 'IDR', VN: 'VND', JP: 'JPY', US: 'USD',
};

export const COUNTRY_LANGUAGE: Record<string, string> = {
  PH: 'tl-PH', SG: 'en-SG', MY: 'ms-MY', TH: 'th-TH', ID: 'id-ID', VN: 'vi-VN', JP: 'ja-JP', US: 'en-US',
};

export const COUNTRY_TZ: Record<string, string> = {
  PH: 'Asia/Manila', SG: 'Asia/Singapore', MY: 'Asia/Kuala_Lumpur', TH: 'Asia/Bangkok',
  ID: 'Asia/Jakarta', VN: 'Asia/Ho_Chi_Minh', JP: 'Asia/Tokyo', US: 'America/New_York',
};

export function toUSD(amount: number, currency: string): number {
  return amount * (USD_RATES[currency] ?? 1);
}
