// api/process-dwg.js - REPLACEMENT FROM CLAUDE

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const CLIENT_ID = process.env.APS_CLIENT_ID;
const CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const NICKNAME = process.env.APS_NICKNAME || 'snapclean';

async function getAccessToken() {
  const response = await axios.post(
    'https://developer.api.autodesk.com/authentication/v2/token',
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'data:read data:write data:create bucket:create bucket:read code:all'
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );
  return response.data.access_token;
}

async function uploadToOSS(accessToken, bucketKey, objectKey, fileData) {
  // Get signed upload URL
  const signedUrlResp = await axios.get(
    `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectKey}/signeds3upload?parts=1`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const { uploadKey, urls } = signedUrlResp.data;

  // Upload to S3
  await axios.put(urls[0], fileData, {
    headers: {
      'Content-Type': 'application/octet-stream'
    }
  });

  // Complete upload
  await axios.post(
    `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectKey}/signeds3upload`,
    {
      uploadKey: uploadKey,
      size: fileData.length
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectKey}`;
}

async function getSignedUrl(accessToken, bucketKey, objectKey) {
  
  const response = await axios.get(
    `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectKey}/signeds3upload?parts=1&minutesExpiration=10`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  
  
  return response.data.urls[0];
}



async function runWorkItem(accessToken, activityId, args) {
  //--DEBUG
  console.log('\n🔍 WorkItem Debug Info:');
  console.log('NICKNAME:', NICKNAME);
  console.log('activityId param:', activityId);
  //console.log('Full activityId being sent:', `${NICKNAME}.${activityId}+prod`);
  //console.log('Arguments:', JSON.stringify(args, null, 2));
  //console.log('');
  
  const workItem = await axios.post(
    'https://developer.api.autodesk.com/da/us-east/v3/workitems',
    {
      activityId: `${NICKNAME}.${activityId}+prod`,
      arguments: args
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const workItemId = workItem.data.id;
  let status = 'pending';
  let statusResp;  // ← Declare here
  let attempts = 0;
  const maxAttempts = 60;

  while ((status === 'pending' || status === 'inprogress') && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    statusResp = await axios.get(
      `https://developer.api.autodesk.com/da/us-east/v3/workitems/${workItemId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    status = statusResp.data.status;
    attempts++;
  }

  if (status !== 'success') {
    // Log the report URL so we can see what failed
    console.error('❌ WorkItem failed. Report URL:', statusResp.data.reportUrl);
    throw new Error(`WorkItem failed with status: ${status}`);
  }

  //-- Seems like workItem has original creation response not the final completed WorkItem with fresh URLs
  //return workItem.data; 
  //return statusResp.data;
  //-- Spreading all the properties returned in statusResp with "..." and adding args
  return {
    ...statusResp.data,
    arguments: args
  };
}

/*
async function callClaudeAPI(layers) {
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a CAD standards expert. Given these DWG layer names, map any non-standard names to standard names following these rules:
- Layers should be UPPERCASE
- Use hyphens not underscores  
- Standard prefixes: A- (architecture), S- (structural), M- (mechanical), E- (electrical), P- (plumbing)
- Remove version numbers or dates
- Consolidate similar layers

Layer names: ${JSON.stringify(layers)}

Return ONLY a CSV format (no markdown, no explanation, no code blocks): oldName,newName
Only include layers that need renaming. If no layers need renaming, return empty string.`
      }]
    },
    {
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }
  );

  return response.data.content[0].text.trim();
}
*/

/*
async function callOpenAIAPI(layers) {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: `You are a CAD standards expert. Given these DWG layer names, map any non-standard names to standard names following these rules:
- Layers should be UPPERCASE
- Use hyphens not underscores  
- Standard prefixes: A- (architecture), S- (structural), M- (mechanical), E- (electrical), P- (plumbing)
- Remove version numbers or dates
- Consolidate similar layers

Layer names: ${JSON.stringify(layers)}

Return ONLY a CSV format (no markdown, no explanation, no code blocks): oldName,newName
Only include layers that need renaming. If no layers need renaming, return empty string.`
      }]
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data.choices[0].message.content.trim();
}
*/

//--Dummy layer renaming function for visible changes before fuzzy mapping
async function callOpenAIAPI(layers) {
  // TEST: Just add "SC-" prefix to all layers
  console.log('🧪 TEST MODE: Adding SC- prefix to all layers');
  
  const mappings = layers.map(layer => `${layer},SC-${layer}`).join('\n');
  
  console.log('Generated mappings:', mappings);
  return mappings;
}

module.exports = async (req, res) => {
  try {
    console.log('🚀 Starting DWG processing...');

    const bucketKey = 'snapclean-temp-bucket-001';
    const objectKey = req.body.objectKey || 'test.dwg';

    // Step 1: Get access token
    console.log('🔐 Getting access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Got access token');

    // Step 2: Verify bucket and upload DWG
    console.log('📦 Verifying bucket exists...');
    try {
      await axios.get(
        `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/details`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      console.log('✅ Bucket exists');
    } catch (e) {
      if (e.response?.status === 404) {
        console.log('📦 Creating bucket...');
        await axios.post(
          'https://developer.api.autodesk.com/oss/v2/buckets',
          { bucketKey, policyKey: 'temporary' },
          { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );
        console.log('✅ Bucket created');
      } else {
        console.log('❌ Bucket check failed:', e.response?.status, e.response?.data);
        throw e;
      }
    }

    console.log('📤 Uploading DWG to OSS...');
    const fileData = await fs.readFile(path.join(process.cwd(), 'scripts', objectKey));
    console.log('📄 File read, size:', fileData.length, 'bytes');

    await uploadToOSS(accessToken, bucketKey, objectKey, fileData);
    console.log('✅ DWG uploaded to OSS');

    /* -- Replacing legacy OSS API URL with direct S3 download call
    const encodedObjectKey = encodeURIComponent(objectKey);
    const dwgUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodedObjectKey}`;
    //console.log('📤 DWG URL for DA:', dwgUrl);

    // TEST: Verify file is accessible
  
    try {
      const testDownload = await axios.head(dwgUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      console.log('✅ File is accessible, size:', testDownload.headers['content-length']);
    } catch (e) {
      console.error('❌ File NOT accessible:', e.response?.status, e.response?.statusText);
      throw new Error('Uploaded file is not accessible');
    }
    */
    
    // Get signed S3 download URL (not the legacy OSS API URL)
    const encodedObjectKey = encodeURIComponent(objectKey);
    const dwgDownloadUrlResp = await axios.get(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodedObjectKey}/signeds3download`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const dwgUrl = dwgDownloadUrlResp.data.url;
    console.log('📤 DWG URL for DA:', dwgUrl);

    /* Skipping test, proceeding with Design Automation...
    // TEST: Verify file is accessible
    try {
      const testDownload = await axios.get(dwgUrl, {
        maxContentLength: 1000,
        responseType: 'arraybuffer'
      });
      console.log('✅ File is accessible, downloaded:', testDownload.data.byteLength, 'bytes');
    } catch (e) {
      console.error('❌ File NOT accessible:', e.response?.status);
      throw new Error('Uploaded file is not accessible');
    }
    */
    console.log('⏭️  Skipping test download for now, proceeding with Design Automation...');

    // Step 3: Get signed URLs for outputs
    console.log('🔗 Getting signed URLs...');
    //-- Saving the layersKey for retrieving later
    //const layersOutputUrl = await getSignedUrl(accessToken, bucketKey, `layers-${Date.now()}.json`);
    const layersKey = `layers-${Date.now()}.json`;
    const layersOutputUrl = await getSignedUrl(accessToken, bucketKey, layersKey);

    const dwgOutputUrl = await getSignedUrl(accessToken, bucketKey, `output-${Date.now()}.dwg`);
    console.log('✅ Signed URLs obtained');

    // Step 4: Extract layers
    console.log('📥 Extracting layers via Design Automation...');
 
    const extractArgs = {
      inputFile: {
        url: dwgUrl  // ← No headers!
      },
      outputLayers: {
        verb: 'put',
        url: layersOutputUrl
      }
    };

    //console.log('📋 ExtractLayers WorkItem args:', JSON.stringify(extractArgs, null, 2));
    //--- Need to access the result from workItem execution to get download URLs etc.
    //await runWorkItem(accessToken, 'ExtractLayersActivity', extractArgs);
    const workItemResult = await runWorkItem(accessToken, 'ExtractLayersActivity', extractArgs);
    
    console.log('📦 WorkItem result keys:', Object.keys(workItemResult));
    console.log('📦 WorkItem result:', JSON.stringify(workItemResult, null, 2));

    console.log('✅ Layers extracted');

    // Step 5: Download layers
    /*
    console.log('📥 Downloading layer data...');
    const layersResp = await axios.get(layersOutputUrl);
    const layers = layersResp.data;
    console.log(`📋 Found ${layers.length} layers:`, layers);
    
    console.log('📥 Downloading layer data...');
    //-- trying to get a new download URL: 
    //const layersResp = await axios.get(workItemResult.arguments.outputLayers.url);
    const layersDownloadResp = await axios.get(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(layersKey)}/signeds3download`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const layersResp = await axios.get(layersDownloadResp.data.url);

    */
    
    /* -------  trying to list all files in bucket since all the URLs used till now seem to not point to this object ---
    console.log('📥 Downloading layer data...');
    console.log('🔑 Using original layers key:', layersKey);

    // Get signed S3 download URL
    const layersDownloadResp = await axios.get(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(layersKey)}/signeds3download`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    console.log('📥 Got download URL');

    // Download from S3
    const layersResp = await axios.get(layersDownloadResp.data.url, {
      responseType: 'json'
    });

    const layers = layersResp.data;
    console.log(`✅ Found ${layers.length} layers:`, layers);
    --------------------------*/
    
    console.log('📥 Finding uploaded layers file...');

    // List recent objects in the bucket
    const listResp = await axios.get(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects?limit=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    console.log(`📦 Found ${listResp.data.items.length} objects in bucket`);

    // Log ALL objects regardless of filter
    console.log('📋 ALL files in bucket:');
    listResp.data.items.forEach(item => {
      console.log(`  - Key: ${item.objectKey}`);
      console.log(`    Size: ${item.size} bytes`);
      console.log(`    Modified: ${item.lastModifiedDate}`);
    });

    // Now try the filter
    const candidateFiles = listResp.data.items
      .filter(item => item.objectKey.includes('layers') || item.size < 10000);

    console.log(`\n🔍 After filter: ${candidateFiles.length} candidates`);

    if (!layersFile) {
      throw new Error('Could not find uploaded layers.json file');
    }

    console.log('📄 Found layers file:', layersFile.objectKey);

    // Download it
    const layersDownloadResp = await axios.get(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(layersFile.objectKey)}/signeds3download`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const layersResp = await axios.get(layersDownloadResp.data.url, {
      responseType: 'json'
    });

    const layers = layersResp.data;
    console.log(`✅ Found ${layers.length} layers:`, layers);

    // EXIT HERE FOR NOW - test extraction first
    return res.json({
      success: true,
      message: 'Layer extraction test complete',
      layers: layers,
      layersCount: layers.length
    });
    
    // Step 6: Call Claude for mappings
    console.log('🤖 Calling Claude API for layer mappings...');
    //-- const mappingCSV = await callClaudeAPI(layers); -- Can change to Claude when you get Claude API key
    const mappingCSV = await callOpenAIAPI(layers);
    console.log('✅ Got mappings from Claude');
    console.log('Mappings:', mappingCSV);

    // Check if there are any mappings to apply
    if (!mappingCSV || mappingCSV.length === 0) {
      console.log('ℹ️  No layer renaming needed');
      return res.json({
        success: true,
        originalLayers: layers,
        mappings: 'No changes needed - all layers are standard',
        message: 'All layers already follow standards'
      });
    }

    // Step 7: Upload mapping CSV
    console.log('📤 Uploading mapping file...');
    await uploadToOSS(accessToken, bucketKey, `mapping-${Date.now()}.csv`, Buffer.from(mappingCSV));
    console.log('✅ Mapping uploaded');

    // Step 8: Rename layers
    console.log('✏️  Renaming layers via Design Automation...');
    await runWorkItem(accessToken, 'RenameLayersActivity', {
      inputFile: {
        url: dwgUrl,
        headers: { Authorization: `Bearer ${accessToken}` }
      },
      mappingFile: {
        url: `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/mapping-${Date.now()}.csv`,
        headers: { Authorization: `Bearer ${accessToken}` }
      },
      outputFile: {
        verb: 'put',
        url: dwgOutputUrl
      }
    });
    console.log('✅ Layers renamed');

    res.json({
      success: true,
      originalLayers: layers,
      mappings: mappingCSV,
      outputUrl: dwgOutputUrl,
      message: 'DWG processed successfully'
    });

  } catch (error) {
    console.error('❌ Error in DWG processing:', error);
    console.error('Full error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to process DWG',
      details: error.response?.data || error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};