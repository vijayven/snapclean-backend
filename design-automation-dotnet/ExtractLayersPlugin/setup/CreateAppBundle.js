const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const CLIENT_ID = process.env.APS_CLIENT_ID;
const CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
const NICKNAME = process.env.APS_NICKNAME || 'snapclean';

async function getAccessToken() {
  const response = await axios.post(
    'https://developer.api.autodesk.com/authentication/v2/token',
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'code:all'
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );
  return response.data.access_token;
}

async function createAppBundle() {
  const bundleName = 'ExtractLayersDLL';
  //const zipPath = path.join(__dirname, '../ExtractLayers/bin/Release/net9.0/ExtractLayers.zip');
  const zipPath = path.join(__dirname, '../ExtractLayers.zip');
  
  console.log(`\n🔨 Creating AppBundle: ${bundleName}`);
  
  try {
    // Step 1: Get token
    console.log('Step 1: Getting access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Token obtained:', accessToken.substring(0, 20) + '...');
    
    const appBundleId = `${NICKNAME}.${bundleName}+prod`;
    console.log('AppBundle ID will be:', appBundleId);

    // Step 2: Verify ZIP exists
    console.log('\nStep 2: Checking ZIP file...');
    if (!fs.existsSync(zipPath)) {
      throw new Error(`ZIP file not found at: ${zipPath}`);
    }
    console.log('✅ ZIP file found');

    // Step 3: Delete if exists
    console.log('\nStep 3: Attempting to delete existing AppBundle...');
    try {
      const deleteUrl = `https://developer.api.autodesk.com/da/us-east/v3/appbundles/${bundleName}`;
      console.log('DELETE URL:', deleteUrl);
      await axios.delete(deleteUrl, { 
        headers: { Authorization: `Bearer ${accessToken}` } 
      });
      console.log('🗑️  Deleted existing AppBundle');
    } catch (e) {
      console.log('ℹ️  No existing AppBundle to delete (or error):', e.response?.status);
    }

    // Step 4: Create AppBundle
    console.log('\nStep 4: Creating new AppBundle...');
    const createUrl = 'https://developer.api.autodesk.com/da/us-east/v3/appbundles';
    console.log('POST URL:', createUrl);
    console.log('Payload:', { id: bundleName, engine: 'Autodesk.AutoCAD+25_0' });
    
    const createResp = await axios.post(
      createUrl,
      {
        id: bundleName,
        engine: 'Autodesk.AutoCAD+25_0',
        description: 'C# DLL to extract layer information from DWG files'
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ AppBundle created');
    console.log(`📦 API returned ID: ${createResp.data.id}`);

    // Step 5: Upload ZIP
    console.log('\nStep 5: Uploading ZIP...');
    const uploadParams = createResp.data.uploadParameters;
    const form = new FormData();

    // Add all form fields EXCEPT 'file' first
    Object.keys(uploadParams.formData).forEach(key => {
      if (key !== 'file') {
        form.append(key, uploadParams.formData[key]);
      }
    });

    // Add file LAST
    const fileStream = fs.createReadStream(zipPath);
    form.append('file', fileStream);

    await axios.post(uploadParams.endpointURL, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    console.log('✅ ZIP uploaded');

    // Step 6: Create alias
    console.log('\nStep 6: Creating alias...');
    const aliasResp = await axios.post(
      `https://developer.api.autodesk.com/da/us-east/v3/appbundles/${bundleName}/aliases`,
      {
        id: 'prod',
        version: 1
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Alias created');
    console.log(`📦 Alias ID: ${aliasResp.data.id}`);
    console.log(`✨ AppBundle ready: ${appBundleId}\n`);
    
  } catch (error) {
    console.error('\n❌ ERROR in createAppBundle:');
    console.error('Message:', error.message);
    console.error('Response status:', error.response?.status);
    console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createAppBundle()
    .then(() => console.log('🎉 AppBundle created successfully!'))
    .catch(err => {
      console.error('❌ Failed:', err.message);
      process.exit(1);
    });
}

module.exports = { createAppBundle };