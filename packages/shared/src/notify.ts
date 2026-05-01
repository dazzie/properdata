export async function notifySlack(message: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch {
    // Slack notification is best-effort — never break the caller
  }
}

export async function notifyDraftReady(opts: {
  subject: string;
  wordCount: number;
  weekEnding: string;
  sections: string[];
}): Promise<void> {
  const lines = [
    `*Weekly pulse draft ready* (week ending ${opts.weekEnding})`,
    `Subject: ${opts.subject}`,
    `Word count: ${opts.wordCount}`,
    `Sections: ${opts.sections.join(', ')}`,
    'Review in Drizzle Studio or the events table.',
  ];
  await notifySlack(lines.join('\n'));
}
