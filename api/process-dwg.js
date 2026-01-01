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

/*
async function getSignedUrl(accessToken, bucketKey, objectKey) {
  
  const response = await axios.get(
    `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectKey}/signeds3upload?parts=1&minutesExpiration=10`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  
  
  //return response.data.urls[0];
  //--- Return objectKey and uploadKey in addition to URL for downloads later   
  return {
    uploadUrl: response.data.urls[0],
    uploadKey: response.data.uploadKey,
    objectKey: objectKey  // The original key you passed in
  };
}
*/

//-----
//-- Potentially replace getSignedUrl with getSignedUploadUrl entirely i.e. delete getSignedUrl() function 
//-----
async function getSignedUrl(accessToken, bucketKey, objectKey) {
  const response = await axios.post(
    `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signed`,
    {
      minutesExpiration: 10
    },
    {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return {
    uploadUrl: response.data.signedUrl,
    objectKey: objectKey
  };
}

/* START:-- Replacing signeds3upload method with standard Signed URL with write permission. 
      This provides a URL where a single PUT operation immediately creates a valid, visible file in the bucket—no "Completion" handshake required.
async function getSignedUploadUrl(accessToken, bucketKey, objectKey) {
  const response = await axios.get(
    `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3upload?parts=1&minutesExpiration=10`,
    {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  //return response.data.uploadUrls[0]; // First part URL
    
  console.log('Upload URL response:', JSON.stringify(response.data, null, 2));
  
  // Try different possible structures
  //return response.data.uploadUrls?.[0] || response.data.urls?.[0] || response.data.signedUrl || response.data;
  return response.data.urls[0]; // ← Return first URL from array

}
*/

/* START: Replacing standard Signed URL that's now legacy with signeds3upload version with explicit "Complete upload" step
async function getSignedUploadUrl(accessToken, bucketKey, objectKey) {
  console.log('--- 🔍 INFRASTRUCTURE AUDIT ---');
  console.log(`Bucket: [${bucketKey}] (Length: ${bucketKey.length})`);
  console.log(`Object: [${objectKey}]`);

  // Manually verify existence one last time right before the failure
  try {
    const check = await axios.get(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/details`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    console.log('✅ Bucket STILL exists at this millisecond');
  } catch (e) {
    console.log('❌ Bucket MISSING or ACCESSED DENIED at this millisecond:', e.response?.status);
  }
  console.log('--- 🚀 ATTEMPTING SIGNED URL ---');
  try {
    const response = await axios.post(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signed`,
      { 
        access: 'write', // Request WRITE permission
        usePrefix: false // Ensure we are writing to the exact key
      }, 
      {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    // The simple signed endpoint returns { signedUrl: "..." }
    return response.data.signedUrl; 
  } catch (error) {
    console.error('❌ Failed to generate upload URL:', error.response ? error.response.data : error.message);
    throw error;
  }
}
//END: -- Replacing signeds3upload method with standard Signed URL with write permission. 
*/
//---- Replacing standard Signed URL that's now legacy with signeds3upload version with explicit "Complete upload" step
//-- START: Now replacing signeds3upload version with explicit "Complete upload" step
//-- PART 1 of replacing signeds3upload version with explicit "Complete upload" step: Deleting existing function
/*
async function getSignedUploadUrl(accessToken, bucketKey, objectKey) {
    // 1. Get the S3 upload URL (Modern way)
    const res = await axios.post(
        `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
        {}, 
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    console.log('Upload URL response:', JSON.stringify(res.data, null, 2));
    const uploadKey = res.data.uploadKey;
    const uploadUrl = res.data.urls[0];

    // 2. CRITICAL: "Complete" the upload setup immediately; Effectively Zero-Byte Commit that tells OSS the file record is ready
    // This removes the "Legacy" block and makes the URL usable for a single PUT.
    await axios.post(
        `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
        { uploadKey: uploadKey },
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    return uploadUrl;
}
*/
//END: ---- Replacing standard Signed URL that's now legacy with signeds3upload version with explicit "Complete upload" step

//-- PART 2 of replacing signeds3upload version with explicit "Complete upload" step: New getSignedUploadUrl( function
//-- New getSignedUploadUrl() function goes back to 'Simple PUT' approach but uses GET + parts=1 to get a 'Single-Shot' S3 URL that DA then uses to PUT layers.json
async function getSignedUploadUrl(accessToken, bucketKey, objectKey) {
  // We use GET and ?parts=1 to get a "one-shot" URL that needs no 'Complete' call.
  const res = await axios.get(
    `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3upload?parts=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  // This URL is direct to S3 and tells S3 the file is finished once the PUT is done.
  return res.data.urls[0];
}

//--- New 2-step multi-part upload logic from Gemini for layers.json to replace getSignedUploadUrl and related code / logic
//--- Step 1 "opens" the file and allows runWorkItem to be run with an uploadKey/url and 
//--- Step 2 "completes" the download AFTER runWorkItem has finished instead of pre-emtively trying to "complete" upload like before
//
//--- Step 1 = startS3Upload() to "open" the file here:
async function startS3Upload(accessToken, bucketKey, objectKey) {
  // Use GET to initiate the upload session
  const res = await axios.get(
    `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  // This returns { uploadKey, urls: [...], ... }
  console.log('startS3Upload response:', JSON.stringify(res.data, null, 2));
  return res.data; 
}

//--- Step 2 = completeS3Upload to "complete" file upload after runWorkItem here:
async function completeS3Upload(accessToken, bucketKey, objectKey, uploadKey) {
    await axios.post(
        `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
        { 
            uploadKey: uploadKey,
            size: 89, // This is hardcoded size got from error logs of previous run since S3 did NOT overwrite this with the actual bytes DA uploaded 
            contentType: 'application/json' // Adding explicit contentType = json to match DA output type to see if hanging call is fixed
        },
        { 
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000 
        }
    );
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
    //const layersOutputUrl = await getSignedUrl(accessToken, bucketKey, layersKey);
    
    //-- replacing getSignedUrl (that got read URL) with getSignedUploadUrl (that uses write URL)
    //const layersSignedData = await getSignedUrl(accessToken, bucketKey, layersKey);
    //const dwgOutputUrl = await getSignedUrl(accessToken, bucketKey, `output-${Date.now()}.dwg`);
    
    //-- Replacing signeds3upload with standard Signed URL with write permission
    //const layersSignedData = await getSignedUploadUrl(accessToken, bucketKey, layersKey);
    //console.log('✅ Layers Signed URLs obtained');
    //const dwgOutputUrl = await getSignedUploadUrl(accessToken, bucketKey, `output-${Date.now()}.dwg`);
    //console.log('✅ dwg Output Signed URLs obtained');
    console.log(`🔑 Target Object Key: ${layersKey}`);
    console.log('--- CRITICAL DEBUG ---');
    console.log('BUCKET_KEY_LENGTH:', bucketKey.length);
    console.log('BUCKET_KEY_VALUE: [' + bucketKey + ']');
    console.log('OBJECT_KEY_VALUE: [' + layersKey + ']');
    console.log('--- END DEBUG ---');

    //-- Replacing Signed URL (Single-Shot) with Direct OSS Put 
    //const layersPutUrl = await getSignedUploadUrl(accessToken, bucketKey, layersKey);
    //-- Reviving Signed URL call this time with explicit complete
    //--- New 2-step multi-part upload logic from Gemini for layers.json to replace getSignedUploadUrl and related code / logic
    //--- Commenting out getSignedUploadUrl() call for now as part of New 2-step multi-part upload logic
    //const layersPutUrl = await getSignedUploadUrl(accessToken, bucketKey, layersKey);

    // Step 4: Extract layers
    console.log('📥 Extracting layers via Design Automation...');
 
    //-- Replacing signeds3upload with standard Signed URL with write permission & simple PUT for layers.json file
    /*
    const extractArgs = {
      inputFile: { url: dwgUrl },
      outputLayers: {
        verb: 'put',
        url: layersSignedData
      }
    };
    */    
    /* START: -- Replacing Signed URL (Single-Shot) with Direct OSS Put 
    const extractArgs = {
      inputFile: { url: dwgUrl },
      outputLayers: {
        verb: 'put',
        url: layersPutUrl // DA 'should' PUT to this simple URL
      }
    };
    */
    
    //-- Going back to Signed URL method, with "explicit upload complete" step since Direct OSS method has been deprecated.
    //const extractArgs = {
    //  inputFile: { url: dwgUrl },
    //  outputLayers: {
    //    verb: 'put',
    //    url: `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${layersKey}`,
    //    headers: { Authorization: `Bearer ${accessToken}` }
    //  }
    //};
   //END: -- Replacing Signed URL (Single-Shot) with Direct OSS Put 

   //--- New 2-step multi-part upload logic from Gemini for layers.json to replace getSignedUploadUrl and related code / logic
   /*
   const extractArgs = {
      inputFile: { url: dwgUrl },
      outputLayers: {
        verb: 'put',
        url: layersPutUrl 
        // IMPORTANT: No headers object here anymore!
      }
    };
   */
    
    /*--- START PART 1: Switching from explit startS3upload and completeS3upload URL based approach to one that uses new URN approach
    //-- URN approach is meant to eliminate need for handing off uploadKey, eTags, file sizes etc across Start and Complete upload
    //-- Step 1: start upload / open file for layers.json output & prepare to run WorkItem
    const s3Data = await startS3Upload(accessToken, bucketKey, layersKey);
    const extractArgs = {
        inputFile: { url: dwgUrl },
        outputLayers: { verb: 'put', url: s3Data.urls[0] }
    };
     --- END Part 1: Switching from explit startS3upload and completeS3upload URL based approach to one that uses new URN approach --*/   

    // No need to call startS3Upload or getSignedUploadUrl anymore!
    // Create an Object URN (Standard format for APS)
    const objectUrn = `urn:adsk.objects:os.object:${bucketKey}/${encodeURIComponent(layersKey)}`;

    const extractArgs = {
        inputFile: { url: dwgUrl },
        outputLayers: { 
            verb: 'put', 
            url: objectUrn, // Pass the URN directly
            headers: {
                Authorization: `Bearer ${accessToken}` // DA uses this to finalize for you
            }
        }
    };
    console.log('📋 ExtractLayers WorkItem args:', JSON.stringify(extractArgs, null, 2));
    //--- Need to access the result from workItem execution to get download URLs etc.
    //await runWorkItem(accessToken, 'ExtractLayersActivity', extractArgs);
    
    //--- Changing from script driven activity to DLL driven activity ExtractLayersActivity --> ExtractLayersDLLActivity
    //const workItemResult = await runWorkItem(accessToken, 'ExtractLayersActivity', extractArgs);
    //const workItemResult = await runWorkItem(accessToken, 'ExtractLayersDLLActivity', extractArgs); -- reverting to non-DLL Activity
    const workItemResult = await runWorkItem(accessToken, 'ExtractLayersActivity', extractArgs);
    
    //-- New code from Gemini (12/20/25) that moved table reading from newer vla-get-layers call to tblnext in run.scr (no .lsp)
    //console.log('📦 WorkItem result keys:', Object.keys(workItemResult));
    //console.log('📦 WorkItem result:', JSON.stringify(workItemResult, null, 2));

    console.log('✅ Layers extracted!');

    //-- New code from Gemini (12/20/25) to download layers.json from what looks like a successful run.scr run short while ago
    //-- Change: Moved table reading from newer vla-get-layers call to older tblnext in run.scr (no .lsp)
    //-- Step 5: Download layers etc. will not work with "return layers;" in place -- needs to be updated to proceed with that
    
    //--- New 2-step multi-part upload logic from Gemini for layers.json to replace getSignedUploadUrl and related code / logic
    //-- if WorkItem is successfull then call completeS3Upload() to finish upload (and hope function doesn't time out)
    if (workItemResult.status === 'success') {
      /*--- START PART 2: Switching from explit startS3upload and completeS3upload URL based approach to one that uses new URN approach  
        console.log('🏁 Job success. Finalizing S3 upload...');
        await completeS3Upload(accessToken, bucketKey, layersKey, s3Data.uploadKey);
        --- END PART 2: Switching from explit startS3upload and completeS3upload URL based approach to one that uses new URN approach ---*/
      
      console.log('🏁 Job success. Waiting for OSS to index the file...');
    
      // Wait 2 seconds for the URN to become "Live" in the bucket
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Download using the same S3-Direct method
      const downloadData = await axios.get(
          `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(layersKey)}/signeds3download`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
      );
        
      console.log('Download URL response:', JSON.stringify(downloadData.data, null, 2));
      // Axios seems to be messing up download file so trying "arraybuffer" method 
      //const finalFile = await axios.get(downloadData.data.url);
      console.log('✅ Download URL received. Fetching raw content...');

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