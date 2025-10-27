const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const CLIENT_ID = process.env.APS_CLIENT_ID;
const CLIENT_SECRET = process.env.APS_CLIENT_SECRET;

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

async function verifyActivity() {
  const accessToken = await getAccessToken();
  
  // Use the full qualified name with alias
  const activityName = 'eFf2exKhDQfaXS32RcAmLvLGXHCmGy40QmkrUA52nF34MOAw.ExtractLayersActivity+prod';

  console.log(`\n🔍 Fetching: ${activityName}\n`);
  
  try {
    const response = await axios.get(
      `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityName}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    console.log('✅ Activity Found!\n');
    console.log('📋 Full Configuration:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n\n🔍 KEY DETAILS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Activity ID:', response.data.id);
    console.log('Version:', response.data.version);
    console.log('\n📝 COMMAND LINE:');
    console.log(response.data.commandLine[0]);
    console.log('\n📦 APPBUNDLES:');
    response.data.appbundles.forEach(bundle => console.log(`  - ${bundle}`));
    console.log('\n⚙️  PARAMETERS:');
    Object.keys(response.data.parameters).forEach(param => {
      console.log(`  - ${param}:`, response.data.parameters[param]);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Error fetching activity:', error.response?.data || error.message);
  }
}

verifyActivity();