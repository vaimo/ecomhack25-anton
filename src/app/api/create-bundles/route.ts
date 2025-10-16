import { NextRequest, NextResponse } from 'next/server';
import { createBundleProducts } from '@/lib/ct';
import { z } from 'zod';

interface BundleWithImages {
  name: string;
  emailBlurb: string;
  targetPrice: number;
  discountPercent: number;
  skus: string[];
  rationale?: string;
  heroImageIdea?: string;
  bundleImageUrl?: string;
  childProductImages?: string[];
}

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
  }),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`🏗️ [${new Date().toISOString()}] Starting bundle products creation...`);

  try {
    const body = await req.json();
    const { plan } = RequestBody.parse(body);

    console.log(`📝 Request parsed: theme="${plan.theme}", bundles=${plan.bundles.length}`);

    // Debug: Log bundle image data
    plan.bundles.forEach((bundle: BundleWithImages, index: number) => {
      console.log(`🔍 API Bundle ${index + 1} "${bundle.name}":`, {
        hasBundleImageUrl: !!bundle.bundleImageUrl,
        bundleImageUrl: bundle.bundleImageUrl,
        hasChildProductImages: !!(bundle.childProductImages && bundle.childProductImages.length > 0),
        childProductImagesCount: bundle.childProductImages?.length || 0
      });
    });

    // Create bundle products in commercetools
    console.log(`🛍️ [${Date.now() - startTime}ms] Creating bundle products in commercetools...`);
    const bundleCreationResult = await createBundleProducts(plan.bundles, plan.theme);
    console.log(`✅ [${Date.now() - startTime}ms] Bundle creation completed - ${bundleCreationResult.successfulProducts}/${bundleCreationResult.totalBundles} successful`);

    const totalTime = Date.now() - startTime;
    console.log(`🎉 [${totalTime}ms] Bundle products creation COMPLETED! Total time: ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      bundleResult: bundleCreationResult,
      meta: {
        totalBundles: bundleCreationResult.totalBundles,
        successfulProducts: bundleCreationResult.successfulProducts,
        failedProducts: bundleCreationResult.failedProducts,
        totalTime: totalTime,
      },
    });

  } catch (error) {
    console.error('❌ Error in /api/create-bundles:', error);
    return NextResponse.json(
      {
        error: 'Failed to create bundle products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint with { "plan": { "theme": "...", "bundles": [...] } } to create bundle products in commercetools'
  });
}