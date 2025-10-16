import { NextRequest, NextResponse } from 'next/server';
import { createBundleCampaign } from '@/lib/klaviyo';
import { polishCopy } from '@/lib/ai';
import { z } from 'zod';

const RequestBody = z.object({
  plan: z.object({
    theme: z.string(),
    bundles: z.array(z.object({
      name: z.string(),
      emailBlurb: z.string(),
      targetPrice: z.number(),
      discountPercent: z.number(),
      skus: z.array(z.string()),
      rationale: z.string().optional(),
      heroImageIdea: z.string().optional(),
      bundleImageUrl: z.string().optional(),
      childProductImages: z.array(z.string()).optional(),
    })),
    overallStrategy: z.string().optional(),
    targetAudience: z.string().optional(),
    customHtml: z.string().optional(), // Add customHtml to schema
    bundleCreationResult: z.any().optional(), // Add bundleCreationResult to schema
  }),
  brandVoice: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, brandVoice } = RequestBody.parse(body);

    console.log(`🎯 Klaviyo API: Creating campaign for ${plan.theme} with ${plan.bundles.length} bundles...`);

    // Debug: Check what HTML data we received
    const customHtml = plan.customHtml;
    const bundleCreationResult = plan.bundleCreationResult;

    console.log(`🔍 Klaviyo API: Received data check:`, {
      hasCustomHtml: !!customHtml,
      customHtmlLength: customHtml?.length || 0,
      customHtmlPreview: customHtml ? customHtml.substring(0, 100) + '...' : 'None',
      hasBundleCreationResult: !!bundleCreationResult,
      brandVoiceProvided: !!brandVoice
    });

    // Polish copy with brand voice if provided
    let processedBundles = plan.bundles;

    if (brandVoice) {
      console.log('✨ Klaviyo API: Polishing copy with brand voice...');
      processedBundles = await Promise.all(
        plan.bundles.map(async (bundle) => ({
          ...bundle,
          emailBlurb: await polishCopy(brandVoice, bundle.emailBlurb),
        }))
      );
    }
    const campaignResult = await createBundleCampaign(processedBundles, plan.theme, customHtml, bundleCreationResult);

    const response: any = {
      success: true,
      campaign: campaignResult,
      summary: {
        theme: plan.theme,
        bundleCount: processedBundles.length,
        campaignId: campaignResult.id,
        status: campaignResult.status,
        brandVoiceApplied: !!brandVoice,
      },
      preview: {
        subject: `🔥 ${plan.theme} Bundles - Limited Time!`,
        bundleNames: processedBundles.map(b => b.name),
        totalValue: processedBundles.reduce((sum, b) => sum + b.targetPrice, 0),
        averageDiscount: Math.round(
          processedBundles.reduce((sum, b) => sum + b.discountPercent, 0) /
          processedBundles.length
        ),
      },
    };

    // Add info about campaign creation
    if (campaignResult.status === 'mock_created') {
      response.warnings = [
        '✅ Demo mode: Campaign preview created successfully!',
        'For production, ensure Klaviyo API key has proper permissions',
        'Check server logs for detailed API call information'
      ];
    } else {
      response.success_info = [
        '🎉 Real campaign created in your Klaviyo account!',
        'Check your Klaviyo dashboard to see the draft campaign',
        'You can edit and send the campaign from Klaviyo'
      ];
    }

    console.log(`Campaign created successfully: ${campaignResult.id}`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in /api/klaviyo:', error);
    return NextResponse.json(
      {
        error: 'Failed to create Klaviyo campaign',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [
          'Check KLAVIYO_API_KEY environment variable',
          'Verify Klaviyo API permissions',
          'Check network connectivity',
        ]
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint with a campaign plan to create a Klaviyo campaign',
    requiredFields: ['plan.theme', 'plan.bundles'],
    optionalFields: ['brandVoice'],
  });
}