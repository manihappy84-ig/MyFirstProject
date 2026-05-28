import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.MISTRAL_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Mistral API key is not configured on the server. Please set MISTRAL_API_KEY in your environment.' },
        { status: 500 }
      );
    }

    const { text, action } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    let prompt = '';
    if (action === 'summarize') {
      prompt = `Summarize the following document text into a clean, concise executive summary with key bullet points. Highlight the main takeaways:\n\n${text}`;
    } else if (action === 'clean') {
      prompt = `Clean up and fix any OCR scan errors, spelling typos, noise, and broken line wraps in the following text. Preserve the original details, paragraphs, and structure exactly, but make it clean and easy to read. Do NOT add any extra chatter, introductions, or conversational greeting. Return ONLY the polished text:\n\n${text}`;
    } else if (action === 'format') {
      prompt = `Format the following raw text into a highly professional, beautifully structured document with clear headings, organized paragraphs, and clean layout (e.g., standard business document style). Keep all original information intact:\n\n${text}`;
    } else {
      prompt = `Analyze and format the following text cleanly:\n\n${text}`;
    }

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'system',
            content: 'You are a highly capable document processing assistant. You help format, clean, and summarize text extracted from PDFs.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Mistral API error response:', errText);
      return NextResponse.json(
        { error: `Mistral API returned an error: ${response.status}` },
        { status: response.status }
      );
    }

    const json = await response.json();
    const resultText = json.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      text: resultText,
    });

  } catch (error: any) {
    console.error('AI process error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process text with AI' },
      { status: 500 }
    );
  }
}
