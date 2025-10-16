import { NextRequest, NextResponse } from 'next/server';
import { ct } from '@/lib/ct';
import type { CampaignPlan } from '@/lib/ai';
import { z } from 'zod';

const RequestBody = z.object({
  plan: z.object({
    bundles: z.array(z.object({
      name: z.string(),
      skus: z.array(z.string()),
      targetPrice: z.number(),
      discountPercent: z.number(),
    })),
  }),
  dryRun: z.boolean().default(true), // Always dry run for safety in hackathon demo
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, dryRun } = RequestBody.parse(body);

    console.log(`Processing ${plan.bundles.length} bundles for price changes (dry run: ${dryRun})...`);

    const priceDrafts = [];
    const bundleDrafts = [];

    for (const bundle of plan.bundles) {
      // Calculate individual item prices within bundle
      const itemPrice = Math.round(bundle.targetPrice / (bundle.skus.length || 1));

      // For each SKU in the bundle, prepare price changes
      for (const sku of bundle.skus) {
        try {
          // In a real implementation, you'd fetch the current product and create price drafts
          priceDrafts.push({
            sku,
            bundleName: bundle.name,
            currentPrice: 'TBD', // Would fetch from CT
            newPrice: itemPrice,
            discountPercent: bundle.discountPercent,
            bundlePrice: bundle.targetPrice,
          });
        } catch (error) {
          console.error(`Error processing SKU ${sku}:`, error);
        }
      }

      // Prepare bundle as a product variant or category
      bundleDrafts.push({
        name: bundle.name,
        skus: bundle.skus,
        price: bundle.targetPrice,
        discount: bundle.discountPercent,
        status: dryRun ? 'draft' : 'ready_to_apply',
      });
    }

    // For hackathon demo, we return the proposed changes without applying them
    const result = {
      status: dryRun ? 'dry_run_complete' : 'changes_applied',
      summary: {
        bundlesProcessed: plan.bundles.length,
        priceChanges: priceDrafts.length,
        totalBundles: bundleDrafts.length,
      },
      priceDrafts,
      bundleDrafts,
      warnings: [
        'This is a demo implementation - no actual price changes were made',
        'In production, this would create price tiers and bundle products in commercetools',
      ],
    };

    console.log('Price draft analysis complete');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/apply:', error);
    return NextResponse.json(
      {
        error: 'Failed to apply changes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint with a campaign plan to preview/apply changes'
  });
}