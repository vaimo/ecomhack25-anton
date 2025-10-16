import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const RequestBody = z.object({
  html: z.string(),
  campaignText: z.string(),
  generateImage: z.boolean().optional().default(true),
  bundles: z.array(z.object({
    name: z.string(),
    skus: z.array(z.string()),
    targetPrice: z.number(),
    discountPercent: z.number(),
    emailBlurb: z.string(),
    bundleImageUrl: z.string().optional(),
    rationale: z.string().optional(),
  })).optional(),
  bundleCreationResult: z.any().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { html, campaignText, generateImage, bundles, bundleCreationResult } = RequestBody.parse(body);

    console.log(`🎨 Lovable: Polishing email template for campaign: ${campaignText.substring(0, 50)}...`);
    console.log(`📦 Lovable: Received ${bundles?.length || 0} bundles for polishing`);
    console.log(`🏗️ Lovable: Bundle creation result available: ${!!bundleCreationResult}`);

    // Prepare enhanced data for Lovable
    const lovablePayload = {
      html,
      campaignText,
      generateImage,
      bundles: bundles || [],
      bundleCreationResult: bundleCreationResult || null,
      bundleMetadata: bundles?.map(bundle => ({
        name: bundle.name,
        skus: bundle.skus,
        skuCount: bundle.skus.length,
        price: bundle.targetPrice,
        discount: bundle.discountPercent,
        hasImage: !!bundle.bundleImageUrl,
        imageUrl: bundle.bundleImageUrl,
      })) || []
    };

    console.log(`📋 Lovable: Sending enhanced bundle metadata for ${lovablePayload.bundleMetadata.length} bundles`);

    // Call the Lovable API
    const response = await fetch('https://rlddmqpvfktwayypuvkt.supabase.co/functions/v1/optimize-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lovablePayload),
    });

    console.log(`📊 Lovable API Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Lovable API Error:', errorText);

      return NextResponse.json(
        {
          error: 'Lovable API failed to optimize email template',
          details: `API returned ${response.status}: ${errorText}`,
          suggestions: [
            'Check if the Lovable API service is running',
            'Verify the API endpoint URL is correct',
            'Try again in a few moments'
          ]
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('✅ Lovable: Email template polished successfully');

    return NextResponse.json({
      success: true,
      optimizedHtml: result.optimizedHtml,
      headerImage: result.headerImage,
      message: result.message || 'Email template polished successfully',
    });

  } catch (error) {
    console.error('❌ Error polishing email:', error);

    return NextResponse.json(
      {
        error: 'Failed to polish email template',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
        suggestions: [
          'Check your network connection',
          'Verify the email HTML is valid',
          'Try again with a different campaign description'
        ]
      },
      { status: 500 }
    );
  }
}


export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to polish an email template with enhanced bundle data',
    endpoint: 'https://rlddmqpvfktwayypuvkt.supabase.co/functions/v1/optimize-email',
    requiredFields: ['html', 'campaignText'],
    optionalFields: ['generateImage', 'bundles', 'bundleCreationResult'],
    bundleFields: ['name', 'skus', 'targetPrice', 'discountPercent', 'emailBlurb', 'bundleImageUrl', 'rationale'],
    example: {
      html: '<html>...</html>',
      campaignText: 'Fall Essentials',
      generateImage: true,
      bundles: [
        {
          name: 'Cozy Bundle',
          skus: ['sku1', 'sku2'],
          targetPrice: 2999,
          discountPercent: 20,
          emailBlurb: 'Perfect for fall...',
          bundleImageUrl: '/bundle-images/bundle.jpg'
        }
      ],
      bundleCreationResult: { /* commercetools creation data */ }
    }
  });
}