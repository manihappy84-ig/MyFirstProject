import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.MISTRAL_API_KEY || process.env.MISTRAL || process.env.Mistral || process.env.mistral;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Mistral API key is not configured on the server. Please set MISTRAL_API_KEY or Mistral in your Vercel Environment Variables.' },
        { status: 500 }
      );
    }

    const { text, action } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    let prompt = '';
    if (action === 'summarize') {
      prompt = `You are an expert executive document analyst. Summarize the following document text into a clean, concise corporate executive summary with key takeaways and bullet points. Reconstruct any mangled branch names or text logically using real-world context (especially Indian and Chennai locations like Mount Road, Mylapore, Pursasawalkam, Sowcarpet, Santhome, Cathedral, Teynampet, Nungambakkam, etc.):\n\n${text}`;
    } else if (action === 'clean') {
      prompt = `You are a world-class OCR error correction engine. The following text contains noisy, garbled, and misaligned OCR text scanned from a document table (specifically, a report showing branch locations, codes, and counts, containing Chennai/Indian areas like Mount Road, Mylapore, Pursasawalkam, Sowcarpet, Santhome, Cathedral, Teynampet, Royapettah, Kilpauk, Anna Nagar, etc.).

Your task:
1. Clean up and correct character misreads (e.g. 'l' or 'I' misread as '1', and letter-level gibberish).
2. Contextually reconstruct heavily garbled branch names to their standard, correct real-world spellings (for example, mapping 'Te A Was' to 'Mount Road', 'Te Iwviworecrenw' to 'Mylapore', 'Jsowoasercuewwa' to 'Pursasawalkam', 'owmomeciewa' to 'Sowcarpet', 'io loumeoracHemnar' to 'Santhome' or 'Royapettah', 'Jaksamcnew' to 'Sadashivnagar' or local branches, etc.) based on contextual and phonetic similarity.
3. Format as a clean, structured table or list, maintaining all correct numbers.
4. Do NOT add any extra conversational chat, intros, greetings, or markdown explanations. Return ONLY the polished, corrected text:\n\n${text}`;
    } else if (action === 'format') {
      prompt = `You are a professional document formatting assistant. The following text contains raw, noisy, or misaligned OCR data from a table (specifically a branch pendency status report with columns like Serial Number, Sol ID, Branch Name, and Counts, featuring Chennai/Indian branch names).

Your task:
1. Intelligently structure this into a highly professional, beautifully aligned Markdown table or business document with clear headings.
2. Clean up header names and verify column alignment.
3. Correct OCR spelling corruptions in branch names or location names by mapping them back to their standard, correct real-world spellings (especially Indian and Chennai branch locations like Mount Road, Mylapore, Pursasawalkam, Sowcarpet, Santhome, Cathedral, Teynampet, Royapettah, Kilpauk, Anna Nagar, etc.) based on contextual and phonetic similarity.
4. Do NOT include any chat intro or conversational greeting. Return ONLY the beautifully formatted markdown content:\n\n${text}`;
    } else {
      prompt = `Analyze, clean, and format the following text cleanly:\n\n${text}`;
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
