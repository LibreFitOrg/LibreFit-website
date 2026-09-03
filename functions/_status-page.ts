import html from '../templates/status.html';

/**
 * Rendered status-page payload shared by every flow that displays a
 * supporter code (/donations/status, /contributors/status, /translators/status).
 */
export interface StatusPageContent {
  statusTitle: string;
  statusDescription: string;
  id: string;
  supporterCode: string;
  urlDesc?: string;
  redirectSnippet?: string;
}

/**
 * Fill templates/status.html placeholders and wrap the result in a
 * text/html Response. Pages containing supporter codes are personalized,
 * so the response is never cacheable.
 */
export function renderStatusPage(content: StatusPageContent): Response {
  const page = html
    .replace('{{STATUS_TITLE}}', content.statusTitle)
    .replace('{{STATUS_DESCRIPTION}}', content.statusDescription)
    .replace('{{ID}}', content.id)
    .replace('{{SUPPORTER_CODE}}', content.supporterCode)
    .replace('{{URL_DESC}}', content.urlDesc ?? '')
    .replace('{{REDIRECT_SNIPPET}}', content.redirectSnippet ?? '');

  return new Response(page, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store',
    },
  });
}