const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

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


async function createActivity(activityName, bundleName, params) {
  const accessToken = await getAccessToken();
  const activityId = `${NICKNAME}.${activityName}+prod`;
  const fullActivityName = `${NICKNAME}.${activityName}`;

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
        `$(engine.path)\\accoreconsole.exe /i "$(args[inputFile].path)" /s "$(appbundles[${bundleName}].path)\\Contents\\run.scr"`
      ],
      engine: 'Autodesk.AutoCAD+25_0',
      appbundles: [`${NICKNAME}.${bundleName}+prod`],
      parameters: params
      // Removed settings section
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

async function main() {
  try {
    // Activity 1: Extract Layers
    await createActivity('ExtractLayersActivity', 'ExtractLayers', {
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
    });

    // Activity 2: Rename Layers
    await createActivity('RenameLayersActivity', 'RenameLayers', {
      inputFile: {
        verb: 'get',
        description: 'Input DWG file',
        required: true,
        localName: 'input.dwg'
      },
      mappingFile: {
        verb: 'get',
        description: 'Layer name mappings CSV',
        required: true,
        localName: 'mapping.csv'
      },
      outputFile: {
        verb: 'put',
        description: 'Modified DWG file',
        required: true,
        localName: 'output.dwg'
      }
    });

    console.log('🎉 All Activities created successfully!');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

main();
