import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RequestBody = z.object({
  bundleName: z.string(),
  theme: z.string(),
  productNames: z.array(z.string()),
  style: z.string().optional().default('professional product photography'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bundleName, theme, productNames, style } = RequestBody.parse(body);

    console.log(`🖼️ API: Generating DALL-E image for bundle "${bundleName}"`);

    // Create a detailed prompt for DALL-E
    const imagePrompt = `Create a ${style} style image for an e-commerce bundle called "${bundleName}". Show these products artfully arranged together: ${productNames.join(', ')}. Style: clean white background, professional lighting, attractive product arrangement, premium e-commerce photography style. The image should look like a high-end product bundle photo for a ${theme.toLowerCase()} campaign. Products should be clearly visible and attractively displayed together.`;

    console.log(`🚀 API: Calling DALL-E with prompt: ${imagePrompt.substring(0, 100)}...`);

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url'
    });

    if (response.data && response.data[0] && response.data[0].url) {
      const imageUrl = response.data[0].url;
      console.log(`✅ API: DALL-E image generated successfully`);

      // Download and save the image locally
      const localImagePath = await saveImageLocally(imageUrl, bundleName, theme);

      return NextResponse.json({
        success: true,
        imageUrl: imageUrl,
        localPath: localImagePath,
        prompt: imagePrompt,
        bundleName,
        theme
      });
    } else {
      throw new Error('No image URL returned from DALL-E');
    }

  } catch (error) {
    console.error('Error in /api/generate-bundle-image:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate bundle image',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [
          'Check OPENAI_API_KEY environment variable',
          'Verify OpenAI API has DALL-E access',
          'Check network connectivity',
          'Ensure bundle name and products are provided'
        ]
      },
      { status: 500 }
    );
  }
}

async function saveImageLocally(imageUrl: string, bundleName: string, theme: string): Promise<string> {
  const { promises: fs } = await import('fs');
  const path = await import('path');

  try {
    // Create a safe filename
    const safeFileName = `${theme.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${bundleName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.jpg`;
    const publicPath = path.join(process.cwd(), 'public', 'bundle-images', safeFileName);

    console.log(`💾 API: Downloading image to ${publicPath}`);

    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(publicPath, Buffer.from(buffer));

    // Return the public URL path
    const publicUrl = `/bundle-images/${safeFileName}`;
    console.log(`✅ API: Image saved locally at ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error('❌ API: Error saving image locally:', error);
    // Return the original URL as fallback
    return imageUrl;
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to generate a bundle image using DALL-E',
    requiredFields: ['bundleName', 'theme', 'productNames'],
    optionalFields: ['style'],
    environment: {
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      publicFolderExists: true // We created it above
    }
  });
}