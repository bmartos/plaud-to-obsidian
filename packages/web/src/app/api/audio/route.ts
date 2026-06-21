import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return new NextResponse('Missing id', { status: 400 });
    }

    const projectRoot = path.resolve(process.cwd(), '../..');
    const dbPath = path.join(projectRoot, 'data', 'plaud_records.db');
    const dbManagerPath = path.join(projectRoot, 'scripts', 'db_manager.py');

    const record = await new Promise<any>((resolve, reject) => {
      const child = spawn('python', [dbManagerPath, 'get', id], {
        env: { ...process.env, DATABASE_URL: dbPath, PYTHONIOENCODING: 'utf-8' }
      });
      let out = '';
      child.stdout.on('data', data => out += data.toString());
      child.on('close', code => {
        if (code === 0 && out.trim()) {
          try {
            resolve(JSON.parse(out));
          } catch (e) {
            reject(new Error('Failed to parse database output'));
          }
        }
        else reject(new Error('Record not found'));
      });
    });

    const audioPath = record.audio_path;
    if (!audioPath || !fs.existsSync(audioPath)) {
      return new NextResponse('Audio file not found', { status: 404 });
    }

    const stat = fs.statSync(audioPath);
    const fileSize = stat.size;
    const range = request.headers.get('range');

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(audioPath, { start, end });

      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': 'audio/mpeg',
      };

      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', chunk => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', err => controller.error(err));
        }
      });

      return new NextResponse(stream, { headers: head, status: 206 });
    } else {
      const head = {
        'Content-Length': fileSize.toString(),
        'Content-Type': 'audio/mpeg',
      };
      const fileStream = fs.createReadStream(audioPath);
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', chunk => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', err => controller.error(err));
        }
      });
      return new NextResponse(stream, { headers: head });
    }
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}
