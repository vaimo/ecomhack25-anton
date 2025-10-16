import { NextRequest, NextResponse } from 'next/server';
import { createBundleDiscountsAndCodes } from '@/lib/ct';
import { createMultipleBundleCheckouts } from '@/lib/stripe';
import { z } from 'zod';

const RequestBody = z.object({
  bundles: z.array(z.object({
    name: z.string(),
    skus: z.array(z.string()),
    targetPrice: z.number(),
    discountPercent: z.number(),
    emailBlurb: z.string(),
    rationale: z.string().optional(),
    heroImageIdea: z.string().optional(),
  })),
  campaignTheme: z.string(),
  createCheckoutSessions: z.boolean().optional().default(true),
  successUrl: z.string().optional().default('/checkout/success'),
  cancelUrl: z.string().optional().default('/checkout/cancel'),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`🎫 [${new Date().toISOString()}] Starting discount codes and checkout creation...`);

  try {
    const body = await req.json();
    const { bundles, campaignTheme, createCheckoutSessions, successUrl, cancelUrl } = RequestBody.parse(body);

    console.log(`📝 Request parsed: ${bundles.length} bundles for "${campaignTheme}" campaign`);

    // Create cart discounts and discount codes in commercetools
    const discountStartTime = Date.now();
    console.log(`🛒 [${Date.now() - startTime}ms] Creating cart discounts and codes in commercetools...`);
    const discountResult = await createBundleDiscountsAndCodes(bundles, campaignTheme);
    console.log(`✅ [${Date.now() - startTime}ms] Discount creation completed in ${Date.now() - discountStartTime}ms - ${discountResult.successfulDiscounts}/${discountResult.totalBundles} successful`);

    let checkoutSessions: any[] = [];
    if (createCheckoutSessions && process.env.STRIPE_SECRET_KEY) {
      // Create Stripe checkout sessions
      const checkoutStartTime = Date.now();
      console.log(`💳 [${Date.now() - startTime}ms] Creating Stripe checkout sessions...`);

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const fullSuccessUrl = successUrl.startsWith('http') ? successUrl : `${baseUrl}${successUrl}`;
      const fullCancelUrl = cancelUrl.startsWith('http') ? cancelUrl : `${baseUrl}${cancelUrl}`;

      checkoutSessions = await createMultipleBundleCheckouts(
        discountResult.bundleDiscounts,
        fullSuccessUrl,
        fullCancelUrl
      );
      console.log(`✅ [${Date.now() - startTime}ms] Stripe checkout creation completed in ${Date.now() - checkoutStartTime}ms - ${checkoutSessions.filter(s => s.id !== 'error').length}/${checkoutSessions.length} successful`);
    } else {
      console.log(`⚠️ Stripe checkout sessions skipped: ${!createCheckoutSessions ? 'disabled by request' : 'no STRIPE_SECRET_KEY'}`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`🎉 [${totalTime}ms] Discount codes and checkout creation COMPLETED! Total time: ${totalTime}ms`);

    // Combine discount data with checkout sessions
    const enhancedBundles = discountResult.bundleDiscounts.map((bundle: any) => {
      const checkoutSession = checkoutSessions.find(session => session.bundle.name === bundle.name);
      return {
        ...bundle,
        checkoutSession: checkoutSession ? {
          id: checkoutSession.id,
          url: checkoutSession.url,
          error: (checkoutSession as any).error
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      discountResult: {
        ...discountResult,
        bundleDiscounts: enhancedBundles
      },
      checkoutSessions: checkoutSessions.filter(s => s.id !== 'error'),
      meta: {
        campaignTheme,
        bundlesProcessed: bundles.length,
        successfulDiscounts: discountResult.successfulDiscounts,
        failedDiscounts: discountResult.failedDiscounts,
        successfulCheckouts: checkoutSessions.filter(s => s.id !== 'error').length,
        failedCheckouts: checkoutSessions.filter(s => s.id === 'error').length,
        totalTime: totalTime,
        stripeEnabled: !!process.env.STRIPE_SECRET_KEY
      },
    });
  } catch (error) {
    console.error('Error in /api/create-discounts:', error);
    return NextResponse.json(
      {
        error: 'Failed to create discount codes and checkout sessions',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [
          'Check commercetools API credentials and permissions',
          'Verify STRIPE_SECRET_KEY environment variable if using Stripe',
          'Ensure bundles have valid SKUs and pricing',
          'Check network connectivity'
        ]
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint with bundles array to create discount codes and checkout sessions',
    requiredFields: ['bundles', 'campaignTheme'],
    optionalFields: ['createCheckoutSessions', 'successUrl', 'cancelUrl'],
    environment: {
      commercetoolsConfigured: !!(process.env.CTP_CLIENT_ID && process.env.CTP_PROJECT_KEY),
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    }
  });
}