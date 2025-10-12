// File: /api/dwg_parser.js | with axios to call APS APIs and just uploading run.scr for now
import fs from 'fs';
import path from 'path';
import qs from 'querystring';

//--- Using non-standard direct path to get axios package since after 1.6.8 there's been issues with package resolution;
//--- Consider downgrading axios to v1.6.8 if needed
//import axios from 'axios';
import axios from 'axios/dist/node/axios.cjs'

console.log('✅ Axios version:', axios.VERSION || 'axios loaded');

export default async function handler(req, res) {
  console.log('✅ API Triggered');

  const { objectKey } = req.body;
  if (!objectKey) return res.status(400).json({ error: 'Missing objectKey' });

  try {
    // STEP 1: Get APS V2 access token (2-legged OAuth)
    console.log('🔐 Requesting access token...');
    const params = new URLSearchParams();
    params.append('client_id', process.env.APS_CLIENT_ID);
    params.append('client_secret', process.env.APS_CLIENT_SECRET);
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'data:read data:write bucket:create bucket:read');

    const tokenResp = await axios.post(
      'https://developer.api.autodesk.com/authentication/v2/token',
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenResp.data.access_token;
    console.log('✅ Got access token');

    // STEP 2: Create bucket (if needed) — you can skip this if already created
    // STEP 2: Create bucket (if needed) — you can skip this if already created
    const bucketKey = process.env.APS_BUCKET_KEY;
    console.log(`📦 Ensuring bucket "${bucketKey}" exists...`);

    await axios.put(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/details`,
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    ).catch(async (err) => {
      if (err.response && err.response.status === 404) {
        try {
          await axios.post(
            'https://developer.api.autodesk.com/oss/v2/buckets',
            {
              bucketKey,
              policyKey: 'transient'
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('✅ Created bucket');
        } catch (creationErr) {
          if (
            creationErr.response &&
            creationErr.response.data?.reason === 'Bucket already exists'
          ) {
            console.log('ℹ️ Bucket already exists, continuing...');
          } else {
            throw creationErr;
          }
        }
      } else {
        throw err;
      }
    });
    

    // STEP 3: Upload file to bucket (presumes local file or base64 handling added)
    console.log('📤 Uploading file...');
    const fileData = Buffer.from('Placeholder content'); // ← REPLACE with real file read
    await axios.put(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectKey}`,
      fileData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileData.length
        }
      }
    );

    console.log('✅ File uploaded to APS');

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Error in DWG upload flow:', err.response?.data || err.message);
    return res.status(500).json({
      error: 'Failed to upload file to APS',
      details: err.response?.data || err.message
    });
  }
}