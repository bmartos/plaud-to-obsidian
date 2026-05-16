import * as fs from 'fs';
import * as path from 'path';
import { PlaudConfig, PlaudAuth, PlaudClient, initDb, updateStatus } from '@plaud/core';
import * as dotenv from 'dotenv';

dotenv.config();

export async function syncCommand(args: string[]): Promise<void> {
  const folder = args[0];
  if (!folder) {
    console.error('Usage: plaud sync <folder>');
    process.exit(1);
  }

  const dbPath = process.env.DATABASE_URL || './data/plaud_records.db';
  const db = await initDb(dbPath);

  const config = new PlaudConfig();
  const auth = new PlaudAuth(config);
  
  // Try to determine region from cached token or default to 'eu'
  const region = process.env.PLAUD_REGION || 'eu';
  const client = new PlaudClient(auth, region as 'us' | 'eu');

  fs.mkdirSync(folder, { recursive: true });

  const recordings = await client.listRecordings();
  console.log(`Found ${recordings.length} recording(s). checking with database...`);

  let synced = 0;
  for (const rec of recordings) {
    // 1st Level Validation: Database
    const existingInDb = await db.get('SELECT id, transcribed FROM recordings WHERE id = ?', rec.id);
    
    // 2nd Level Validation: File System (Double check)
    const date = new Date(rec.start_time).toISOString().slice(0, 10);
    const slug = rec.filename?.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 50) || 'recording';
    const shortId = rec.id.slice(0, 8);
    const mdFile = path.join(folder, `${date}_${slug}_${shortId}.md`);

    if (existingInDb?.transcribed && fs.existsSync(mdFile)) {
      continue;
    }

    console.log(`Syncing: ${rec.filename} (${rec.id})...`);
    const detail = await client.getRecording(rec.id);

    if (!detail.transcript || detail.transcript.trim().length === 0) {
      console.log(`Skipping: ${rec.filename} - No transcript available.`);
      continue;
    }

    const durationMin = rec.duration ? Math.round(rec.duration / 60000) : 0;
    const safeDuration = isNaN(durationMin) ? 0 : durationMin;

    const content = [
      '---',
      `plaud_id: ${rec.id}`,
      `title: "${rec.filename}"`,
      `date: ${date}`,
      `duration: ${safeDuration}m`,
      `source: plaud`,
      '---',
      '',
      `# ${rec.filename}`,
      '',
      detail.transcript,
    ].join('\n');

    fs.writeFileSync(mdFile, content);

    // Update Database Status
    await updateStatus(db, {
      id: rec.id,
      title: rec.filename,
      date: date,
      transcribed: 1,
      final_path: mdFile
    });

    synced++;
  }

  console.log(synced > 0 ? `Synced ${synced} recording(s) and updated database.` : 'Already up to date.');
  await db.close();
}
