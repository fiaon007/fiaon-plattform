/**
 * Investor Metrics Configuration
 * Only metrics with visible=true will render on the public investor page.
 * Set visible=false for any metric you don't want to publish yet.
 */

export interface InvestorMetric {
  label: string;
  value: string;
  note?: string;
  visible: boolean;
}

export const investorMetrics: InvestorMetric[] = [
  {
    label: "Platform Users",
    value: "500+",
    note: "Active alpha users across industries",
    visible: true,
  },
  {
    label: "Paying Customers",
    value: "0",
    note: "",
    visible: false,
  },
  {
    label: "Monthly Recurring Revenue",
    value: "€0",
    note: "",
    visible: false,
  },
  {
    label: "Weekly Call Minutes",
    value: "",
    note: "",
    visible: false,
  },
  {
    label: "Activation Rate",
    value: "",
    note: "% of users completing first campaign",
    visible: false,
  },
  {
    label: "Active Companies (30d)",
    value: "",
    note: "",
    visible: false,
  },
];
