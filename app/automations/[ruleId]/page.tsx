import App from "../../../src/App";

type AutomationRulePageProps = {
  params: Promise<{
    ruleId: string;
  }>;
};

export default async function AutomationRulePage({
  params,
}: AutomationRulePageProps) {
  const { ruleId } = await params;

  return <App currentView="automation-form" automationRuleId={ruleId} />;
}
