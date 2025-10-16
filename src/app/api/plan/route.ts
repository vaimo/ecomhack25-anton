import { NextRequest, NextResponse } from 'next/server';
import { getCandidateProducts, saveCampaignPlan } from '@/lib/ct';
import { planCampaign } from '@/lib/ai';
import { z } from 'zod';

const RequestBody = z.object({
  theme: z.string().default('Fall Essentials'),
  productLimit: z.number().optional().default(40),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`🚀 [${new Date().toISOString()}] Starting campaign plan generation...`);

  try {
    const body = await req.json();
    const { theme, productLimit } = RequestBody.parse(body);

    console.log(`📝 Request parsed: theme="${theme}", productLimit=${productLimit}`);

    // Fetch products from commercetools
    const ctStartTime = Date.now();
    console.log(`🛒 [${Date.now() - startTime}ms] Fetching ${productLimit} products from commercetools...`);
    const products = await getCandidateProducts(productLimit);
    console.log(`✅ [${Date.now() - startTime}ms] CommerceTool fetch completed in ${Date.now() - ctStartTime}ms - Got ${products.length} products`);

    if (products.length === 0) {
      return NextResponse.json(
        { error: 'No products found in catalog' },
        { status: 404 }
      );
    }

    // Transform products for AI processing
    const transformStartTime = Date.now();
    console.log(`🔄 [${Date.now() - startTime}ms] Transforming product data for AI...`);
    const catalogSample = products.map(product => {
      // Extract image URLs from product variant
      const images = product.masterData.current.masterVariant?.images?.map(img => img.url) || [];

      return {
        id: product.id,
        name: product.masterData.current.name?.en || product.key || 'Unnamed Product',
        price: product.masterData.current.masterVariant?.prices?.[0]?.value?.centAmount || 0,
        stock: product.masterData.current.masterVariant?.availability?.availableQuantity ?? 100,
        tags: product.masterData.current.categories?.map(cat => cat.id) || [],
        images: images,
        mainImage: images[0] || null, // First image as main image
      };
    });
    console.log(`✅ [${Date.now() - startTime}ms] Product transformation completed in ${Date.now() - transformStartTime}ms`);

    console.log(`🤖 [${Date.now() - startTime}ms] Starting AI campaign planning with ${catalogSample.length} products...`);

    // Generate AI campaign plan
    const aiStartTime = Date.now();
    const plan = await planCampaign({ theme, catalogSample });
    console.log(`✅ [${Date.now() - startTime}ms] AI planning completed in ${Date.now() - aiStartTime}ms - Generated ${plan.bundles.length} bundles`);

    // Save plan to commercetools
    const saveStartTime = Date.now();
    console.log(`💾 [${Date.now() - startTime}ms] Saving campaign plan to CommerceTools...`);
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await saveCampaignPlan(planId, {
      ...plan,
      createdAt: new Date().toISOString(),
      productCount: catalogSample.length,
    });
    console.log(`✅ [${Date.now() - startTime}ms] Plan saved in ${Date.now() - saveStartTime}ms with ID: ${planId}`);

    // Create product lookup map
    console.log(`🔗 [${Date.now() - startTime}ms] Creating product lookup map...`);
    const productMap = Object.fromEntries(
      catalogSample.map(product => [product.id, product])
    );

    const totalTime = Date.now() - startTime;
    console.log(`🎉 [${totalTime}ms] Campaign plan generation COMPLETED! Total time: ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      planId,
      plan,
      products: productMap, // Include product data for the UI
      meta: {
        productsProcessed: catalogSample.length,
        bundlesGenerated: plan.bundles.length,
        totalTime: totalTime,
      },
    });
  } catch (error) {
    console.error('Error in /api/plan:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate campaign plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint with { "theme": "Your Campaign Theme" } to generate a plan'
  });
}