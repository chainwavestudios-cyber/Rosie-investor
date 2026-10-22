import useFronterMarketing from '@/components/fronter/marketing/useFronterMarketing';
import MarketingTemplateWorkspace from '@/components/fronter/marketing/MarketingTemplateWorkspace';
import MarketingTestSender from '@/components/fronter/marketing/MarketingTestSender';
import MarketingSendPanel from '@/components/fronter/marketing/MarketingSendPanel';

export default function FronterMarketingTab() {
  const marketing = useFronterMarketing();
  return <div className="mx-auto max-w-6xl space-y-5 font-assistant text-assistant-ink" data-testid="fronter-mailjet-marketing">
    <header><h2 className="text-xl font-semibold">Marketing · Mailjet account 2</h2><p className="mt-1 text-sm text-assistant-muted">Stephani video emails and your existing HTML mailer, sent only through Mailjet account 2. Google email stays in Emails.</p></header>
    {marketing.error && <p role="alert" className="calendar-error">{marketing.error}</p>}
    {marketing.loading ? <p role="status" className="text-assistant-muted">Loading Mailjet account 2 templates…</p> : <>
      <MarketingTemplateWorkspace marketing={marketing} />
      <MarketingTestSender template={marketing.template} call={marketing.call} />
      <MarketingSendPanel template={marketing.template} call={marketing.call} />
    </>}
  </div>;
}