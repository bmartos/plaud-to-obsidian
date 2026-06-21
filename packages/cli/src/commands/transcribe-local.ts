import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export async function transcribeLocalCommand(args: string[]): Promise<void> {
  const audioPath = args[0];
  const modelSize = args[1] || 'medium'; // Default to medium as per project mandate
  const obsidianFolder = args[2]; // Optional: if provided, will generate the .md file

  if (!audioPath) {
    console.error('Usage: plaud transcribe-local <audio-path> [model-size] [obsidian-folder]');
    console.log('Example: plaud transcribe-local ./recording.mp3 medium C:/Obsidian/Notes');
    process.exit(1);
  }

  const absoluteAudioPath = path.resolve(audioPath);
  if (!fs.existsSync(absoluteAudioPath)) {
    console.error(`Error: Audio file not found at ${absoluteAudioPath}`);
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, 'scripts', 'transcribe_local.py');
  const pythonPath = 'C:\\Python314\\python.exe';
  const tempDir = path.join(projectRoot, 'temp');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const baseName = path.basename(audioPath).split('.')[0] || 'recording';
  const tempOutputPath = path.join(tempDir, `transcription_${baseName}.txt`);

  console.log(`Starting local transcription with diarization...`);
  console.log(`Model: ${modelSize}`);
  console.log(`Audio: ${absoluteAudioPath}`);
  console.log(`Temporary Output: ${tempOutputPath}`);
  console.log('---');

  try {
    // Explicitly using the temporary output path in the command
    const command = `"${pythonPath}" "${scriptPath}" "${absoluteAudioPath}" ${modelSize} "${tempOutputPath}"`;
    execSync(command, { encoding: 'utf-8', stdio: 'inherit' });
    
    // Check if the output file exists and has content
    if (fs.existsSync(tempOutputPath)) {
      const transcript = fs.readFileSync(tempOutputPath, 'utf-8');
      
      if (transcript.trim().length > 0) {
        console.log(`\nTranscription completed successfully.`);
        
        if (obsidianFolder) {
          const date = new Date().toISOString().slice(0, 10);
          const slug = baseName.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 50);
          const mdFile = path.join(obsidianFolder, `${date}_${slug}_local.md`);
          
          const content = [
            '---',
            `title: "${baseName}"`,
            `date: ${date}`,
            `source: whisper-local`,
            `model: ${modelSize}`,
            '---',
            '',
            `# ${baseName}`,
            '',
            transcript,
          ].join('\n');

          fs.mkdirSync(obsidianFolder, { recursive: true });
          fs.writeFileSync(mdFile, content);
          console.log(`Obsidian note created: ${mdFile}`);
        }
      } else {
        console.log('\nTranscription produced an empty result. Skipping Obsidian file creation.');
      }
    }
  } catch (error: any) {
    console.error('Error during local transcription:');
    console.error(error.message);
    process.exit(1);
  }
}
