import { PlaudConfig, PlaudAuth, PlaudClient } from '@plaud/core';

export async function transcriptCommand(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) {
    console.error('Usage: plaud transcript <recording-id>');
    process.exit(1);
  }

  const config = new PlaudConfig();
  const auth = new PlaudAuth(config);
  const region = process.env.PLAUD_REGION || 'eu';
  const client = new PlaudClient(auth, region as 'us' | 'eu');

  const detail = await client.getRecording(id);

  if (detail.transcript && detail.transcript.length > 0) {
    console.log(detail.transcript);
  } else {
    console.log('No transcript available for this recording.');
  }
}
