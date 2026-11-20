import type { EmailTemplateKind } from './tesla-email-templates';
import { getTeslaEmailBaseCopy } from './tesla-email-templates';

type InvokeClient = {
  functions: {
    invoke: (
      name: string,
      options: { body: Record<string, unknown>; headers?: Record<string, string> }
    ) => Promise<{ data: any; error: any }>;
  };
};

export async function translateTeslaEmailPayload(
  client: InvokeClient,
  language: string,
  kind: EmailTemplateKind,
  dynamic: { status?: string; detail?: string } = {},
  authorization?: string
): Promise<{ localizedCopy: Record<string, string>; localizedStatus?: string; localizedDetail?: string } | null> {
  const target = String(language || 'en').toLowerCase().split('-')[0];
  if (!target || target === 'en') return null;
  const base = getTeslaEmailBaseCopy(kind);
  const sources: Array<{ key: string; text: string }> = [
    { key: 'subject', text: base.subject },
    { key: 'eyebrow', text: base.eyebrow },
    { key: 'title', text: base.title },
    { key: 'body', text: base.body },
    { key: 'greeting', text: 'Hello' },
    { key: 'supportLine', text: 'If you need assistance, reply to this email or contact our support team.' },
    { key: 'closing', text: 'Kind regards' },
    { key: 'referenceLabel', text: 'Reference' },
    { key: 'statusLabel', text: 'Status' },
    { key: 'amountLabel', text: 'Amount' },
  ];
  if (base.action) sources.push({ key: 'action', text: base.action });
  if (dynamic.status) sources.push({ key: 'dynamic_status', text: dynamic.status });
  if (dynamic.detail) sources.push({ key: 'dynamic_detail', text: dynamic.detail.slice(0, 1700) });

  try {
    const { data, error } = await client.functions.invoke('tesla-markets-translate', {
      body: {
        target_language: target,
        source_language: 'en',
        component: 'transactional-email:' + kind,
        texts: sources,
      },
      ...(authorization ? { headers: { Authorization: authorization } } : {}),
    });
    if (error || !Array.isArray(data?.translations)) {
      console.error('Tesla Markets email translation unavailable; sending the approved English template.', error?.message || data?.error || 'Invalid translation response');
      return null;
    }
    const translated = new Map<string, string>();
    for (const row of data.translations) {
      if (typeof row?.key === 'string' && typeof row?.text === 'string' && row.text.trim()) {
        translated.set(row.key, row.text.trim());
      }
    }
    for (const item of sources) {
      if (!translated.has(item.key)) {
        console.error('Tesla Markets email translation incomplete:', { language: target, kind, missingKey: item.key });
        return null;
      }
    }
    return {
      localizedCopy: {
        subject: translated.get('subject')!,
        eyebrow: translated.get('eyebrow')!,
        title: translated.get('title')!,
        body: translated.get('body')!,
        greeting: translated.get('greeting')!,
        supportLine: translated.get('supportLine')!,
        closing: translated.get('closing')!,
        referenceLabel: translated.get('referenceLabel')!,
        statusLabel: translated.get('statusLabel')!,
        amountLabel: translated.get('amountLabel')!,
        ...(base.action ? { action: translated.get('action')! } : {}),
      },
      ...(dynamic.status ? { localizedStatus: translated.get('dynamic_status')! } : {}),
      ...(dynamic.detail ? { localizedDetail: translated.get('dynamic_detail')! } : {}),
    };
  } catch (error) {
    console.error('Tesla Markets email translation error; sending the approved English template.', error);
    return null;
  }
}
