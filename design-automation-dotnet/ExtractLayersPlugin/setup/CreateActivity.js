const axios = require('axios');
const path = require('path');
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

async function createActivity() {
  const accessToken = await getAccessToken();
  const activityName = 'ExtractLayersDLLActivity';
  const bundleName = 'ExtractLayersDLL';
  const activityId = `${NICKNAME}.${activityName}+prod`;

  console.log(`\n🔨 Creating Activity: ${activityName}`);
  console.log(`📦 Expected Activity ID: ${activityId}`);

  // Delete entire activity (all versions and aliases)
  try {
    await axios.delete(
      `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityName}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    console.log('🗑️  Deleted existing Activity and all versions');
  } catch (e) {
    console.log('ℹ️  No existing Activity to delete');
  }

  // Create Activity
  const createResp = await axios.post(
    'https://developer.api.autodesk.com/da/us-east/v3/activities',
    {
      id: activityName,
      commandLine: [
        `$(engine.path)\\accoreconsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[${bundleName}].path)" /s "$(settings[script].path)"`
      ],
      engine: 'Autodesk.AutoCAD+25_0',
      appbundles: [`${NICKNAME}.${bundleName}+prod`],
      parameters: {
        inputFile: {
          verb: 'get',
          description: 'Input DWG file',
          required: true,
          localName: 'input.dwg'
        },
        outputLayers: {
          verb: 'put',
          description: 'Extracted layer names',
          required: true,
          localName: 'layers.json'
        }
      },
      settings: {
        script: {
          value: 'ExtractLayers\n'
        }
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  console.log('✅ Activity created');
  console.log(`📦 API returned ID: ${createResp.data.id}`);
  console.log(`📦 Using AppBundle: ${NICKNAME}.${bundleName}+prod`);

  // Create alias
  const aliasResp = await axios.post(
    `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityName}/aliases`,
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
  console.log(`✨ Activity ready: ${activityId}\n`);
}

// Run if called directly
if (require.main === module) {
  createActivity()
    .then(() => console.log('🎉 Activity created successfully!'))
    .catch(err => {
      console.error('❌ Failed:', err.response?.data || err.message);
      process.exit(1);
    });
}

module.exports = { createActivity };