# Deployment Guide

## Fixed: Read-Only File System Error

The application has been updated to use **Cloudinary** for file storage instead of local file system, which resolves the `EROFS: read-only file system` error in deployment environments.

## Required Environment Variables

Add these to your deployment platform (Vercel, Netlify, etc.):

```env
# MongoDB Connection
MONGODB_URI=your-mongodb-connection-string

# NextAuth Configuration  
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=https://your-deployed-domain.com

# Cloudinary Configuration (REQUIRED for file uploads)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

## Cloudinary Setup

1. Create a free account at [cloudinary.com](https://cloudinary.com)
2. Go to your Dashboard to find your credentials:
   - Cloud Name
   - API Key  
   - API Secret
3. Add these values to your deployment environment variables

## Changes Made

- **File uploads now use Cloudinary** instead of local storage
- **PDF utilities updated** to handle both cloud URLs and local paths
- **Backward compatibility maintained** for existing templates
- **No code changes needed** for existing functionality

## Deployment Platforms

This fix works with:
- ✅ Vercel
- ✅ Netlify  
- ✅ AWS Lambda
- ✅ Any serverless platform with read-only file systems

## Testing

After deployment with proper environment variables:
1. Upload a new template (image or PDF)
2. Verify it appears correctly in admin interface
3. Test PDF generation with placeholders
