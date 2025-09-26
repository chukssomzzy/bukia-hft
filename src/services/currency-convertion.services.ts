import axios from "axios";

import config from "../config";

export class CurrencyConversionService {
  private apiKey = config.EXCHANGE_RATES_APP_ID;
  private apiUrl = "https://v6.exchangerate-api.com/v6";

  async convert(amount: number, from: string, to: string): Promise<number> {
    const rate = await this.getRate(from, to);
    return amount * rate;
  }

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;
    const url = `${this.apiUrl}/${this.apiKey}/pair/${from}/${to}`;
    const { data } = await axios.get(url);
    if (data.result !== "success") {
      throw new Error("Failed to fetch conversion rate");
    }
    return data.conversion_rate;
  }
}

export const currencyConversionService = new CurrencyConversionService();
