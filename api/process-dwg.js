import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  console.log("⏳ Received request at /api/process-dwg");

  if (req.method !== 'POST') {
    return res.status(405).send("Method Not Allowed");
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const dwgBuffer = Buffer.concat(chunks);
    const inputPath = path.join('/tmp', 'input.dwg');
    const outputPath = path.join('/tmp', 'cleaned_output.dwg');

    fs.writeFileSync(inputPath, dwgBuffer);
    console.log("📥 Saved input DWG to: ", inputPath);

    const python = spawn('python3', ['dwg-parser/dwg_cleaner.py', inputPath, outputPath]);

    let scriptLogs = "";

    python.stdout.on('data', (data) => {
      const msg = data.toString();
      scriptLogs += msg;
      console.log("🐍 Python stdout:", msg.trim());
    });

    python.stderr.on('data', (data) => {
      const msg = data.toString();
      scriptLogs += msg;
      console.error("❌ Python stderr:", msg.trim());
    });

    python.on('close', (code) => {
      console.log(`🔚 Python script finished with code ${code}`);
      if (!fs.existsSync(outputPath)) {
        return res.status(500).send("❌ Processing failed. Output not found.\n" + scriptLogs);
      }

      const cleanedBuffer = fs.readFileSync(outputPath);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="cleaned_output.dwg"');
      res.send(cleanedBuffer);
    });
  });
}