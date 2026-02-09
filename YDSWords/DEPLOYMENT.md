# YDS Words - Netlify Deployment Guide

## Overview
This guide explains how to deploy the secure API proxy for YDS Words using Netlify Functions.

## Architecture
```
iOS App → Netlify Function → OpenAI API
         (API key hidden)
```

## Deployment Steps

### 1. Install Netlify CLI (Optional - for local testing)
```bash
npm install -g netlify-cli
```

### 2. Deploy to Netlify

#### Option A: Deploy via Git (Recommended)
1. Push your code to GitHub/GitLab/Bitbucket
2. Connect your repository to Netlify:
   - Go to [Netlify Dashboard](https://app.netlify.com/)
   - Click "Add new site" → "Import an existing project"
   - Connect your Git provider and select the repository
3. Configure build settings:
   - Build command: (leave empty)
   - Publish directory: (leave as root or set to `YDSWords` if repo has other projects)
4. Click "Deploy site"

#### Option B: Manual Deploy
```bash
cd YDSWords
netlify deploy --prod --dir=.
```

### 3. Configure Environment Variables
1. Go to your site's dashboard on Netlify
2. Navigate to **Site settings** → **Environment variables**
3. Click "Add a variable"
4. Add your OpenAI API key:
   - Key: `OPENAI_API_KEY`
   - Value: `sk-proj-...` (your actual API key)
5. Click "Save"

### 4. Update API Endpoint in iOS App

After deployment, update the endpoint URL in `assets/js/api.js`:

```javascript
const API_CONFIG = {
    // Replace with your actual Netlify site URL
    endpoint: 'https://your-site-name.netlify.app/.netlify/functions/generate-question'
};
```

### 5. Redeploy iOS App
1. Update the API endpoint in the code
2. Rebuild the iOS app in Xcode
3. Submit to App Store (or TestFlight for testing)

## Local Development

### Test Netlify Function Locally
```bash
cd YDSWords

# Create .env file with your API key
echo "OPENAI_API_KEY=sk-proj-..." > .env

# Start Netlify dev server
netlify dev
```

The function will be available at:
```
http://localhost:8888/.netlify/functions/generate-question
```

Update `api.js` to use local endpoint for testing:
```javascript
const API_CONFIG = {
    endpoint: 'http://localhost:8888/.netlify/functions/generate-question'
};
```

### Test the Function
```bash
curl -X POST http://localhost:8888/.netlify/functions/generate-question \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a fill-in-the-blank question for the word: ambiguous"}'
```

## Important Security Notes

### ⚠️ Rotate Your Compromised API Key
If your API key was previously exposed in the JavaScript code:

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Revoke the old key immediately
3. Create a new key
4. Update the `OPENAI_API_KEY` environment variable in Netlify
5. Delete the old key from your code history

### API Key Protection
- ✅ API key is stored in Netlify environment variables (encrypted at rest)
- ✅ Key is never exposed to the client/iOS app
- ✅ Key only exists in server memory during function execution

### Rate Limiting (Recommended Enhancement)
Consider adding rate limiting to your Netlify function to prevent abuse:

```javascript
// Add to generate-question.js
const rateLimit = new Map();

exports.handler = async (event, context) => {
    // Simple IP-based rate limiting
    const clientIP = event.headers['client-ip'] || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 10; // 10 requests per minute
    
    const clientData = rateLimit.get(clientIP) || { count: 0, resetTime: now + windowMs };
    
    if (now > clientData.resetTime) {
        clientData.count = 0;
        clientData.resetTime = now + windowMs;
    }
    
    if (clientData.count >= maxRequests) {
        return {
            statusCode: 429,
            headers,
            body: JSON.stringify({ error: 'Rate limit exceeded' })
        };
    }
    
    clientData.count++;
    rateLimit.set(clientIP, clientData);
    
    // ... rest of handler
};
```

## Troubleshooting

### Function Not Found (404)
- Check that `netlify.toml` is in the root directory
- Verify the function file is at `netlify/functions/generate-question.js`
- Check Netlify deploy logs for errors

### 500 Server Error
- Check that `OPENAI_API_KEY` environment variable is set
- View function logs in Netlify Dashboard → Functions → generate-question

### CORS Errors
- The function includes CORS headers by default
- If you see CORS errors, check that `Access-Control-Allow-Origin` is set correctly

### Timeout Errors
- Netlify Functions have a 10-second timeout on the free tier
- OpenAI API usually responds within 5-10 seconds
- If timeouts occur, consider using a paid Netlify plan (26s timeout)

## Monitoring

### View Function Logs
1. Netlify Dashboard → Your Site → Functions
2. Click on "generate-question" function
3. View invocation logs

### Set Up Alerts (Optional)
Configure alerts for:
- High error rates
- Unusual traffic patterns
- Approaching OpenAI usage limits

## Cost Considerations

### Netlify Free Tier
- **125,000 function invocations/month** (more than enough for this app)
- 100 hours of runtime/month
- No cost for the function itself

### OpenAI API Costs
- GPT-4o-mini: ~$0.15 per 1M input tokens, $0.60 per 1M output tokens
- Each question generation uses roughly:
  - Input: ~500 tokens (prompt)
  - Output: ~300 tokens (response)
- Cost per question: ~$0.0002 (extremely low)
- 1000 questions/day = ~$0.20/day = ~$6/month

## Next Steps

1. Deploy the Netlify function
2. Update the API endpoint in the iOS app
3. Test thoroughly
4. Submit to App Store
5. Monitor usage and costs

## Support

If you encounter issues:
1. Check Netlify function logs
2. Test the function with curl locally
3. Verify environment variables are set correctly
4. Check OpenAI API status at https://status.openai.com/
