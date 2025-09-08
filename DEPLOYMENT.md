# Deployment Guide

## Security Features

This application includes several security and cost-control measures for production deployment:

### 1. Scraping Endpoint Protection
- **Disabled by default** in production (`NODE_ENV=production`)
- Prevents unauthorized content scraping and potential abuse

### 2. Rate Limiting for Chat API
- **Production limits**: 5 requests/minute per IP, 100 requests/day max
- **Development limits**: 20 requests/minute per IP, unlimited daily
- Protects against excessive API costs and abuse
- Returns proper HTTP 429 responses with retry headers

### 3. Environment-based Configuration
- Automatic detection of production vs development
- Different rate limits and security policies per environment

## Environment Variables Required

```bash
# AI/ML APIs  
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key_here

# Vector Database
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=your_pinecone_index_name_here

# Environment (automatically set by most platforms)
NODE_ENV=production
```

## Deployment Platforms

### Vercel (Recommended)
1. Connect your GitHub repository
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### Netlify
1. Connect repository  
2. Set build command: `npm run build`
3. Set publish directory: `.next`
4. Add environment variables

### Railway/Render/etc
1. Follow standard Next.js deployment process
2. Ensure NODE_ENV=production is set
3. Add required environment variables

## Cost Control Measures

1. **Rate limiting** prevents excessive API usage
2. **Scraping disabled** prevents unauthorized data ingestion
3. **Small vector chunks** reduce embedding costs
4. **Efficient retrieval** minimizes redundant API calls

## Monitoring Recommendations

- Monitor API usage in Google Cloud Console
- Track Pinecone vector database usage  
- Set up billing alerts for cost control
- Monitor rate limit violations in application logs

## Local Development

- Use `NODE_ENV=development` for local testing
- Higher rate limits and scraping enabled
- All features accessible for development and testing