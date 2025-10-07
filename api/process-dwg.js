// File: /api/dwg_parser.js | with axios to call APS APIs and just uploading run.scr for now
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import qs from 'querystring';

export default async function handler(req, res) {
  try {
    const clientId = process.env.APS_CLIENT_ID;
    const clientSecret = process.env.APS_CLIENT_SECRET;
    const bucketKey = process.env.APS_BUCKET_KEY || 'snapclean-temp-bucket-001';
    const objectKey = 'run.scr'; // file name in bucket
    const localFilePath = path.join(process.cwd(), 'scripts', 'run.scr');

    // 1. Get access token
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResponse = await axios.post(
      'https://developer.api.autodesk.com/authentication/v1/authenticate',
      qs.stringify({
        grant_type: 'client_credentials',
        scope: 'data:read data:write bucket:create bucket:read',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    console.log('✔ Access token obtained');

    // 2. Request signed URL
    const signedUrlResponse = await axios.post(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectKey}/signeds3upload`,
      { minutesExpiration: 15 },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { uploadKey, urls } = signedUrlResponse.data;
    const signedPutUrl = urls[0];
    console.log('✔ Signed URL received');

    // 3. Upload file using signed URL
    const fileBuffer = fs.readFileSync(localFilePath);

    const uploadResponse = await axios.put(signedPutUrl, fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length,
      },
    });

    console.log('✔ File uploaded via signed URL', uploadResponse.status);

    // 4. Complete the upload with POST
    const finalizeResponse = await axios.post(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectKey}/signeds3upload`,
      { uploadKey },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✔ Upload finalized');
    return res.status(200).json({ message: 'File uploaded to APS successfully!' });

  } catch (error) {
    console.error('❌ Error in DWG upload flow:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to upload file to APS', details: error.response?.data || error.message });
  }
}