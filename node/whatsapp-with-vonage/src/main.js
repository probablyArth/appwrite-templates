import jwt from 'jsonwebtoken';
import sha256 from 'sha256';
import { fetch } from 'undici';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticFolder = path.join(__dirname, '../static');

export default async ({ req, res }) => {
  if (
    !process.env.VONAGE_API_KEY ||
    !process.env.VONAGE_API_SECRET ||
    !process.env.VONAGE_API_SIGNATURE_SECRET ||
    !process.env.VONAGE_WHATSAPP_NUMBER
  ) {
    throw new Error('Missing environment variables.');
  }

  if (req.method === 'GET') {
    const html = fs
      .readFileSync(path.join(staticFolder, 'index.html'))
      .toString();
    return res.send(html, 200, { 'Content-Type': 'text/html; charset=utf-8' });
  }

  const token = (req.headers.authorization ?? '').split(' ')[1];
  var decoded = jwt.verify(token, process.env.VONAGE_API_SIGNATURE_SECRET, {
    algorithms: ['HS256'],
  });

  if (sha256(req.bodyString) != decoded['payload_hash']) {
    return res.json({ ok: false, error: 'Payload hash mismatch.' }, 401);
  }

  if (!req.body.from) {
    return res.json(
      { ok: false, error: 'Missing required parameter: from.' },
      400
    );
  }

  const text = req.body.text ?? 'I only accept text messages.';

  const basicAuthToken = btoa(
    `${process.env.VONAGE_API_KEY}:${process.env.VONAGE_API_SECRET}`
  );
  await fetch(`https://messages-sandbox.nexmo.com/v1/messages`, {
    method: 'POST',
    body: JSON.stringify({
      from: process.env.VONAGE_WHATSAPP_NUMBER,
      to: req.body.from,
      message_type: 'text',
      text: `Hi there! You sent me: ${text}`,
      channel: 'whatsapp',
    }),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basicAuthToken}`,
    },
  });

  return res.json({ ok: true });
};
