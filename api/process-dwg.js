// File: /api/dwg_parser.js | with axios to call APS APIs and just uploading run.scr for now
//import fs from 'fs';
//import fs from 'fs/promises';
const fs = require('fs').promises;
//import path from 'path';
const path = require('path');
//import qs from 'querystring';
const qs = require('querystring');

//--- Using non-standard direct path to get axios package since after 1.6.8 there's been issues with package resolution;
//--- Consider downgrading axios to v1.6.8 if needed
//import axios from 'axios';
//import axios from 'axios/dist/node/axios.cjs' // was working but changing it to be aligned with fs, path and qs imports
const axios = require('axios');

console.log('✅ Axios version:', axios.VERSION || 'axios loaded');

//export default async function handler(req, res) {
module.exports = async function handler(req, res) {
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
    
    // Step 3: Get signed upload URL and headers from APS
    console.log('📥 Requesting signed S3 upload URL...');

    const signedUrlResp = await axios.post(
      `https://developer.api.autodesk.com/data/v2/buckets/${bucketKey}/objects/${objectKey}/signeds3upload`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const { url: signedUrl, headers: signedHeaders } = signedUrlResp.data;
    console.log('✅ Got signed upload URL from APS');

    // STEP 4: Upload file to bucket 
    console.log('📤 Uploading file to signed S3 URL...');

    const fileData = await fs.readFile(path.join(process.cwd(), 'scripts', objectKey));

    //const { url: signedUrl, headers: signedHeaders } = uploadResp.data;
    await axios.put(signedUrl, fileData, { headers: signedHeaders });
    
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