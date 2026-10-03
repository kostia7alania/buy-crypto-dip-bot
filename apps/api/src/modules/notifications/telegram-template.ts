export const TELEGRAM_TEMPLATE_VERSION = 1 as const;

export type NotificationClassification = "TENANT_FINANCIAL";

interface DigestPortfolioInputs {
  investedUsdt: number;
  currentValueUsdt: number | null;
  pnlUsdt: number | null;
  pnlPercent: number | null;
}

interface TelegramTemplateBase {
  version: typeof TELEGRAM_TEMPLATE_VERSION;
}

export type TelegramTemplateV1 =
  | (TelegramTemplateBase & {
      key: "RISK_REJECTED";
      inputs: {
        strategyName: string;
        symbol: string;
        price: number;
        reasonCodes: string[];
      };
    })
  | (TelegramTemplateBase & {
      key: "ORDER_PENDING";
      inputs: {
        strategyName: string;
        symbol: string;
        price: number;
        quoteAmount: number;
        secondsLeft: number;
        totalSeconds: number;
      };
    })
  | (TelegramTemplateBase & {
      key: "ORDER_COMPLETED";
      inputs: {
        strategyName: string;
        symbol: string;
        price: number;
        quoteAmount: number;
      };
    })
  | (TelegramTemplateBase & {
      key: "DAILY_DIGEST";
      inputs: {
        buyCount: number;
        dips: Array<{ symbol: string; count: number }>;
        spent24hUsdt: number;
        portfolio: DigestPortfolioInputs | null;
      };
    });

export interface RenderedTelegramTemplate {
  text: string;
  parseMode: "HTML";
}

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const SYMBOL_PATTERN = /^[A-Z0-9]{3,20}$/;
const REASON_CODE_PATTERN = /^[A-Z0-9_]{2,80}$/;

const invalid = (code: string): never => {
  throw new Error(`TELEGRAM_TEMPLATE_INVALID:${code}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
  code: string,
): void => {
  const actual = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (
    actual.length !== allowed.length ||
    actual.some((key, index) => key !== allowed[index])
  ) {
    invalid(code);
  }
};

const boundedText = (
  value: unknown,
  code: string,
  maxLength: number,
): string => {
  if (typeof value !== "string") return invalid(code);
  if (value.length < 1 || value.length > maxLength) return invalid(code);
  return value;
};

const finiteNumber = (
  value: unknown,
  code: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return invalid(code);
  }
  if (options.integer && !Number.isSafeInteger(value)) return invalid(code);
  if (options.min !== undefined && value < options.min) return invalid(code);
  if (options.max !== undefined && value > options.max) return invalid(code);
  return value;
};

const symbol = (value: unknown, code: string): string => {
  const result = boundedText(value, code, 20);
  if (!SYMBOL_PATTERN.test(result)) invalid(code);
  return result;
};

const financialInputs = (value: unknown, code: string) => {
  const inputs = isRecord(value) ? value : invalid(code);
  exactKeys(
    inputs,
    ["strategyName", "symbol", "price", "quoteAmount"],
    `${code}_KEYS`,
  );
  return {
    strategyName: boundedText(inputs.strategyName, `${code}_STRATEGY`, 120),
    symbol: symbol(inputs.symbol, `${code}_SYMBOL`),
    price: finiteNumber(inputs.price, `${code}_PRICE`, { min: 0 }),
    quoteAmount: finiteNumber(inputs.quoteAmount, `${code}_AMOUNT`, {
      min: 0,
    }),
  };
};

export const parseTelegramTemplate = (input: unknown): TelegramTemplateV1 => {
  const template = isRecord(input) ? input : invalid("ENVELOPE");
  exactKeys(template, ["version", "key", "inputs"], "ENVELOPE_KEYS");
  if (template.version !== TELEGRAM_TEMPLATE_VERSION) invalid("VERSION");

  if (template.key === "RISK_REJECTED") {
    const inputs = isRecord(template.inputs)
      ? template.inputs
      : invalid("RISK_INPUTS");
    exactKeys(
      inputs,
      ["strategyName", "symbol", "price", "reasonCodes"],
      "RISK_INPUT_KEYS",
    );
    const reasons = Array.isArray(inputs.reasonCodes)
      ? inputs.reasonCodes
      : invalid("RISK_REASONS");
    if (reasons.length > 10) invalid("RISK_REASONS");
    const reasonCodes = reasons.map((reason: unknown) => {
      const result = boundedText(reason, "RISK_REASON", 80);
      if (!REASON_CODE_PATTERN.test(result)) invalid("RISK_REASON");
      return result;
    });
    return {
      version: TELEGRAM_TEMPLATE_VERSION,
      key: "RISK_REJECTED",
      inputs: {
        strategyName: boundedText(inputs.strategyName, "RISK_STRATEGY", 120),
        symbol: symbol(inputs.symbol, "RISK_SYMBOL"),
        price: finiteNumber(inputs.price, "RISK_PRICE", { min: 0 }),
        reasonCodes,
      },
    };
  }

  if (template.key === "ORDER_PENDING") {
    const inputs = isRecord(template.inputs)
      ? template.inputs
      : invalid("PENDING_INPUTS");
    exactKeys(
      inputs,
      [
        "strategyName",
        "symbol",
        "price",
        "quoteAmount",
        "secondsLeft",
        "totalSeconds",
      ],
      "PENDING_INPUT_KEYS",
    );
    const base = financialInputs(
      {
        strategyName: inputs.strategyName,
        symbol: inputs.symbol,
        price: inputs.price,
        quoteAmount: inputs.quoteAmount,
      },
      "PENDING",
    );
    const totalSeconds = finiteNumber(inputs.totalSeconds, "PENDING_TOTAL", {
      min: 1,
      max: 3_600,
      integer: true,
    });
    const secondsLeft = finiteNumber(inputs.secondsLeft, "PENDING_LEFT", {
      min: 0,
      max: totalSeconds,
      integer: true,
    });
    return {
      version: TELEGRAM_TEMPLATE_VERSION,
      key: "ORDER_PENDING",
      inputs: { ...base, secondsLeft, totalSeconds },
    };
  }

  if (template.key === "ORDER_COMPLETED") {
    return {
      version: TELEGRAM_TEMPLATE_VERSION,
      key: "ORDER_COMPLETED",
      inputs: financialInputs(template.inputs, "COMPLETED"),
    };
  }

  if (template.key === "DAILY_DIGEST") {
    const inputs = isRecord(template.inputs)
      ? template.inputs
      : invalid("DIGEST_INPUTS");
    exactKeys(
      inputs,
      ["buyCount", "dips", "spent24hUsdt", "portfolio"],
      "DIGEST_INPUT_KEYS",
    );
    const dipInputs = Array.isArray(inputs.dips)
      ? inputs.dips
      : invalid("DIGEST_DIPS");
    if (dipInputs.length > 20) invalid("DIGEST_DIPS");
    const dips = dipInputs.map((candidate: unknown) => {
      const dip = isRecord(candidate) ? candidate : invalid("DIGEST_DIP");
      exactKeys(dip, ["symbol", "count"], "DIGEST_DIP_KEYS");
      return {
        symbol: symbol(dip.symbol, "DIGEST_DIP_SYMBOL"),
        count: finiteNumber(dip.count, "DIGEST_DIP_COUNT", {
          min: 1,
          integer: true,
        }),
      };
    });
    let portfolio: DigestPortfolioInputs | null = null;
    if (inputs.portfolio !== null) {
      const value = isRecord(inputs.portfolio)
        ? inputs.portfolio
        : invalid("DIGEST_PORTFOLIO");
      exactKeys(
        value,
        ["investedUsdt", "currentValueUsdt", "pnlUsdt", "pnlPercent"],
        "DIGEST_PORTFOLIO_KEYS",
      );
      portfolio = {
        investedUsdt: finiteNumber(value.investedUsdt, "DIGEST_INVESTED", {
          min: 0,
        }),
        currentValueUsdt:
          value.currentValueUsdt === null
            ? null
            : finiteNumber(value.currentValueUsdt, "DIGEST_VALUE", {
                min: 0,
              }),
        pnlUsdt:
          value.pnlUsdt === null
            ? null
            : finiteNumber(value.pnlUsdt, "DIGEST_PNL"),
        pnlPercent:
          value.pnlPercent === null
            ? null
            : finiteNumber(value.pnlPercent, "DIGEST_PNL_PERCENT"),
      };
      const valuations = [
        portfolio.currentValueUsdt,
        portfolio.pnlUsdt,
        portfolio.pnlPercent,
      ];
      if (
        valuations.some((value) => value === null) &&
        !valuations.every((value) => value === null)
      ) {
        invalid("DIGEST_PARTIAL_TOTALS");
      }
    }
    return {
      version: TELEGRAM_TEMPLATE_VERSION,
      key: "DAILY_DIGEST",
      inputs: {
        buyCount: finiteNumber(inputs.buyCount, "DIGEST_BUY_COUNT", {
          min: 0,
          integer: true,
        }),
        dips,
        spent24hUsdt: finiteNumber(inputs.spent24hUsdt, "DIGEST_SPENT", {
          min: 0,
        }),
        portfolio,
      },
    };
  }

  return invalid("KEY");
};

export const classificationForTemplate = (
  _template: TelegramTemplateV1,
): NotificationClassification => "TENANT_FINANCIAL";

export const escapeTelegramHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const amount = (value: number): string =>
  value.toLocaleString("en-US", { maximumFractionDigits: 8 });

const money = (value: number): string => value.toFixed(2);

export const renderTelegramTemplate = (
  input: unknown,
): RenderedTelegramTemplate => {
  const template = parseTelegramTemplate(input);
  if (template.key === "RISK_REJECTED") {
    const reasons = template.inputs.reasonCodes
      .map(escapeTelegramHtml)
      .join(", ");
    return {
      parseMode: "HTML",
      text:
        `⚠️ <b>RiskGuard Alert</b>\n\n` +
        `• <b>Strategy:</b> ${escapeTelegramHtml(template.inputs.strategyName)}\n` +
        `• <b>Symbol:</b> ${escapeTelegramHtml(template.inputs.symbol)}\n` +
        `• <b>Price:</b> $${amount(template.inputs.price)}\n` +
        `• <b>Action:</b> REJECTED\n` +
        `• <b>Reasons:</b> ${reasons || "POLICY_REJECTED"}`,
    };
  }

  if (template.key === "ORDER_PENDING") {
    const progress = Math.min(
      10,
      Math.round(
        ((template.inputs.totalSeconds - template.inputs.secondsLeft) /
          template.inputs.totalSeconds) *
          10,
      ),
    );
    const bar = "▓".repeat(progress) + "░".repeat(10 - progress);
    return {
      parseMode: "HTML",
      text:
        `🚨 <b>Pending Buy Alert</b>\n\n` +
        `• <b>Strategy:</b> ${escapeTelegramHtml(template.inputs.strategyName)}\n` +
        `• <b>Symbol:</b> ${escapeTelegramHtml(template.inputs.symbol)}\n` +
        `• <b>Price:</b> $${amount(template.inputs.price)}\n` +
        `• <b>Amount:</b> ${amount(template.inputs.quoteAmount)} USDT\n` +
        `• <b>Status:</b> ⏳ Executing in <b>${template.inputs.secondsLeft}s</b>\n` +
        `<code>${bar}</code>`,
    };
  }

  if (template.key === "ORDER_COMPLETED") {
    return {
      parseMode: "HTML",
      text:
        `🎉 <b>Dry-Run Order Executed</b>\n\n` +
        `• <b>Strategy:</b> ${escapeTelegramHtml(template.inputs.strategyName)}\n` +
        `• <b>Symbol:</b> ${escapeTelegramHtml(template.inputs.symbol)}\n` +
        `• <b>Price:</b> $${amount(template.inputs.price)}\n` +
        `• <b>Amount:</b> ${amount(template.inputs.quoteAmount)} USDT\n` +
        `• <b>Status:</b> Simulated Purchase`,
    };
  }

  const dips = template.inputs.dips
    .map((dip) => `${escapeTelegramHtml(dip.symbol)}×${dip.count.toString()}`)
    .join(", ");
  const portfolio = template.inputs.portfolio;
  const sign =
    portfolio && portfolio.pnlUsdt !== null && portfolio.pnlUsdt >= 0
      ? "+"
      : "";
  const portfolioLine = portfolio
    ? `• <b>Portfolio:</b> <code>${money(portfolio.investedUsdt)} USDT</code> invested, ` +
      (portfolio.currentValueUsdt !== null &&
      portfolio.pnlUsdt !== null &&
      portfolio.pnlPercent !== null
        ? `now <code>${money(portfolio.currentValueUsdt)}</code> ` +
          `(<code>${sign}${money(portfolio.pnlUsdt)} / ${sign}${money(portfolio.pnlPercent)}%</code>)\n`
        : "valuation unavailable: missing or stale market data.\n")
    : "";
  return {
    parseMode: "HTML",
    text:
      `☕️ <b>Morning digest</b>\n\n` +
      `• <b>Simulated buys (24h):</b> <code>${template.inputs.buyCount}</code>\n` +
      (dips ? `• <b>Dips caught:</b> ${dips}\n` : "") +
      `• <b>Spent (24h):</b> <code>${money(template.inputs.spent24hUsdt)} USDT</code>\n` +
      portfolioLine +
      `\nDRY_RUN. Fees and slippage are not modelled.\n` +
      `\nSee /pnl, /performance or /backtest for details.`,
  };
};

export const renderTelegramFallback = (
  correlationId: string,
): RenderedTelegramTemplate => {
  const reference = CORRELATION_ID_PATTERN.test(correlationId)
    ? correlationId
    : "reference-unavailable";
  return {
    parseMode: "HTML",
    text:
      `⚠️ <b>Dry-run update unavailable</b>\n\n` +
      `The update could not be rendered safely. ` +
      `Audit reference: <code>${escapeTelegramHtml(reference)}</code>`,
  };
};
