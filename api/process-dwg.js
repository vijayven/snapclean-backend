// api/process-dwg.js - REPLACEMENT FROM CLAUDE

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

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

    // Step 3: Create Object URN for outputs after generating unique layersKey for retrieving later
    //         Switched from URL to URN method which seems more modern and better supported; avoids uploadKey hand-offs etc.
    
    //-- Trying to create a more unique layers.json per client than just timestamp based
    //const layersKey = `layers-${Date.now()}.json`;   
    // Generate a 6-character random hex string
    const uniqueId = crypto.randomBytes(3).toString('hex'); 
    const layersKey = `layers-${Date.now()}-${uniqueId}.json`;

    console.log('📥 Extracting layers via Design Automation to: ', layersKey, " ...");
    const objectUrn = `urn:adsk.objects:os.object:${bucketKey}/${encodeURIComponent(layersKey)}`;

    const extractArgs = {
        inputFile: { url: dwgUrl },
        outputLayers: { 
            verb: 'put', 
            url: objectUrn, // Pass the URN directly
            headers: {
                Authorization: `Bearer ${accessToken}` // DA uses this to finalize file/complete upload for you
            }
        }
    };
    
    console.log('📋 ExtractLayers WorkItem args:', JSON.stringify(extractArgs, null, 2));
    const workItemResult = await runWorkItem(accessToken, 'ExtractLayersActivity', extractArgs);
    
    console.log('✅ Layers extracted!');

    if (workItemResult.status === 'success') {
      console.log('🏁 Job success. Waiting for OSS to index the file...');

      // Download using the same S3-Direct method as part of new URN method
      const downloadData = await axios.get(
          `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(layersKey)}/signeds3download`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
      );
        
      console.log('Download URL response:', JSON.stringify(downloadData.data, null, 2));
      console.log('✅ Download URL received. Fetching raw content...');

      // Axios messing up download file since it tries to be "smart" when it sees .json extension and tries to parse the stream immediately
      // But S3 URL here contains very heavy response-content-disposition string which causes Axios to hangs because it’s waiting for the end of a stream that is being "throttled" or misread due to these header parameters.
      // Using "arraybuffer" method with Axios to prevent this "smart auto-parsing" thats causing DL call to hang
      //const finalFile = await axios.get(downloadData.data.url);
      const finalFile = await axios.get(downloadData.data.url, {
          responseType: 'arraybuffer', // Tells Axios: "Just give me the bytes"
          decompress: false            // Prevents Axios from trying to unzip the stream
      });

      // Convert the buffer back to a JSON object
      const layersData = JSON.parse(Buffer.from(finalFile.data).toString());

      console.log('📄 Extracted Layers:', layersData);

      // Instead of just 'return', use the response object which is the "Clean Exit" for Vercel
      return res.status(200).json({
          success: true,
          layers: layersData,
          message: "Extraction complete"
      });
      return finalFile.data;
    } 
    else {
      console.error('❌ WorkItem Failed:', workItemResult.reportUrl);
      throw new Error('Design Automation Job Failed');
    }

    // Step 5: Download layers
    
   // After WorkItem completes
    console.log('🔍 Original layersKey:', layersKey);

    // Try to download -- DEBUG
    console.log('📥 Attempting download with key:', layersKey);
    /*

    const layersDownloadResp = await axios.get(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(layersKey)}/signeds3download`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const layersResp = await axios.get(layersDownloadResp.data.url, {
      responseType: 'json'
    });

    const layers = layersResp.data;
    console.log(`✅ Found ${layers.length} layers:`, layers);
    */

    console.log('📊 Parsing report for S3 upload URL...');
    const reportResp = await axios.get(workItemResult.reportUrl);
    const reportText = reportResp.data;

    /*
    const uploadMatch = reportText.match(/Uploading '.*?layers\.json'.*?url - '([^']+)'/s);
    if (uploadMatch) {
      let s3Url = uploadMatch[1];
      console.log('📤 Found S3 upload URL:', s3Url);
      
      // The upload URL can be converted to a download URL by removing query params and using GET
      // S3 URLs are accessible without auth for a limited time
      console.log('🔄 Attempting direct S3 download...');
      
      try {
        const layersResp = await axios.get(s3Url, {
          responseType: 'json',
          timeout: 10000
        });
        
        const layers = layersResp.data;
        console.log(`✅ SUCCESS! Found ${layers.length} layers:`, layers);
        
        // SUCCESS - use this data
        return res.json({
          success: true,
          message: 'Layer extraction complete',
          layers: layers,
          layersCount: layers.length
        });
      } catch (e) {
        console.log('❌ Direct S3 download failed:', e.response?.status, e.message);
      }
    }
    */
    const uploadMatch = reportText.match(/signed-url-uploads\/([a-f0-9-]+)/);
    if (uploadMatch) {
      const uuid = uploadMatch[1];
      console.log('🔑 Extracted UUID:', uuid);
      
      const listResp = await axios.get(
        `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects?startsAt=signed-url-uploads/${uuid}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      console.log('📦 Found objects:', listResp.data.items);
    }

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