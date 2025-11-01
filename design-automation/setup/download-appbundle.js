const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const CLIENT_ID = process.env.APS_CLIENT_ID;
const CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
const NICKNAME = process.env.APS_NICKNAME;

async function getAccessToken() {
  const response = await axios.post(
    'https://developer.api.autodesk.com/authentication/v2/token',
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'code:all'
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data.access_token;
}

async function downloadAppBundle() {
  const token = await getAccessToken();
  const bundleName = `${NICKNAME}.ExtractLayers+prod`;
  
  try {
    // Get AppBundle details
    console.log('📦 Fetching AppBundle details...');
    console.log('Bundle name:', bundleName);
    
    const details = await axios.get(
      `https://developer.api.autodesk.com/da/us-east/v3/appbundles/${bundleName}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('AppBundle details:', JSON.stringify(details.data, null, 2));
    
    // Get the package URL
    const packageUrl = details.data.package;
    console.log('\n📥 Downloading from:', packageUrl);
    
    // Download the zip
    const response = await axios.get(packageUrl, {
      responseType: 'arraybuffer'
    });
    
    const downloadPath = path.join(__dirname, 'downloaded-bundle.zip');
    fs.writeFileSync(downloadPath, response.data);
    console.log('✅ Downloaded to:', downloadPath);
    
    // Extract and show contents
    console.log('\n📋 Bundle Contents:');
    const zip = new AdmZip(downloadPath);
    const entries = zip.getEntries();
    
    entries.forEach(entry => {
      console.log(`\n📄 ${entry.entryName} (${entry.header.size} bytes)`);
      
      if (entry.entryName.endsWith('.xml') || 
          entry.entryName.endsWith('.lsp') ||
          entry.entryName.endsWith('.scr')) {
        console.log('--- Content ---');
        console.log(entry.getData().toString('utf8'));
        console.log('---------------');
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

downloadAppBundle();