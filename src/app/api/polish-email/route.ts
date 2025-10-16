import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const RequestBody = z.object({
  html: z.string(),
  campaignText: z.string(),
  generateImage: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { html, campaignText, generateImage } = RequestBody.parse(body);

    console.log(`🎨 Lovable: Polishing email template for campaign: ${campaignText.substring(0, 50)}...`);

    // Call the Lovable API
    const response = await fetch('https://rlddmqpvfktwayypuvkt.supabase.co/functions/v1/optimize-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html,
        campaignText,
        generateImage,
      }),
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
    message: 'POST to this endpoint with { "html": "email-html", "campaignText": "description", "generateImage": true } to polish an email template',
    endpoint: 'https://rlddmqpvfktwayypuvkt.supabase.co/functions/v1/optimize-email',
  });
}