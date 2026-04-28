/**
 * Disclaimers required on subscriber-facing analytical content.
 *
 * Compliance basis:
 *   - Financial advice regulation (Central Bank of Ireland boundary)
 *   - GDPR transparency obligations
 *   - EU AI Act Article 50 (transparency for AI-generated content, Aug 2026+)
 *
 * Append the appropriate disclaimer to analytical outputs surfaced to
 * subscribers — newsletter, web app, AI analyst chat, MCP server responses.
 */

export const DISCLAIMERS = {
  /**
   * General analysis disclaimer. Append to all analytical outputs.
   */
  general: `This analysis reflects market data from public sources and should not be construed as financial, investment, tax, or legal advice. Consult a qualified professional before making decisions based on this content.`,

  /**
   * Grant-specific disclaimer. Append to all grant calculation outputs.
   */
  grant: `Grant eligibility is determined by the relevant scheme administrator based on documentation submitted at application. This estimate reflects publicly available rules as of the date below and should be confirmed with the scheme administrator (SEAI, your local authority, Revenue, or the Department of Housing as applicable) before relying on it for a purchase decision.`,

  /**
   * Yield-specific disclaimer. Append to all rental yield analyses.
   */
  yield: `Yield estimates are based on the most recent RTB Rent Index data and standard cost assumptions. Actual yield will depend on tenancy outcomes, expense levels, and tax circumstances specific to the investor. Consult a qualified tax advisor before making investment decisions.`,

  /**
   * AI transparency notice. Required on all AI-generated content from August 2026
   * under EU AI Act Article 50.
   */
  aiTransparency: `This content was assisted by AI agents using verified public data sources, with editorial review.`,
} as const;

/**
 * The current date in ISO format. Used in disclaimers to make the as-of date
 * explicit. Update when generating content; do not rely on a stale string.
 */
export function currentAsOfDate(): string {
  return new Date().toISOString().slice(0, 10);
}
