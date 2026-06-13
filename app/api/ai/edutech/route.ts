import { NextRequest, NextResponse } from 'next/server';

function cleanJSONString(str: string): string {
  // Remove markdown code block markers if present
  let cleaned = str.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.MISTRAL_API_KEY || process.env.MISTRAL || process.env.Mistral || process.env.mistral;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Mistral API key is not configured on the server. Please set MISTRAL_API_KEY in your Environment Variables.' },
        { status: 500 }
      );
    }

    const { text, action, chapterIndex, chapterTitle } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    let prompt = '';
    let systemInstruction = 'You are a highly capable educational assistant. You output raw JSON strictly conforming to the requested schema. Never output any extra text, conversation, greetings, or markdown code blocks like ```json.';

    if (action === 'outline') {
      prompt = `You are a curriculum design specialist. Divide the following learning material text into exactly 10 distinct, sequential chapters or sub-sections.
If the text is too short, break it up by logical paragraphs or key concepts.

Return a valid JSON array of exactly 10 objects. Each object must have:
- "index": a number from 1 to 10
- "title": a short, descriptive chapter title
- "contentSummary": a 2-3 sentence summary of what this chapter covers from the text
- "rawTextChunk": a relevant excerpt or chunk of text from the material that matches this chapter (roughly 1/10th of the input text)

JSON format:
[
  { "index": 1, "title": "Chapter Title", "contentSummary": "Summary here...", "rawTextChunk": "excerpt..." },
  ...
]

Learning material:
${text}`;
    } else if (action === 'worksheet') {
      prompt = `You are an expert school teacher. Create a comprehensive, engaging learning worksheet for Chapter ${chapterIndex}: "${chapterTitle}" based on the following chapter text.

Return a valid JSON object with the following fields:
- "summary": a clear, 2-3 paragraph summary of the key concepts in this chapter
- "keyTerms": an array of 3 to 5 objects, each having "term" (the word) and "definition" (its meaning)
- "fillInBlanks": an array of exactly 3 objects, each having "sentence" (a sentence with a word replaced by "_______") and "answer" (the correct missing word)
- "discussionQuestions": an array of 2 to 3 objects, each having "question" (open-ended question) and "sampleAnswer" (a model response)

JSON format:
{
  "summary": "Chapter summary...",
  "keyTerms": [
    { "term": "Concept", "definition": "Description" }
  ],
  "fillInBlanks": [
    { "sentence": "Next.js is a _______ framework.", "answer": "React" }
  ],
  "discussionQuestions": [
    { "question": "Explain X.", "sampleAnswer": "X is..." }
  ]
}

Chapter text:
${text}`;
    } else if (action === 'test') {
      prompt = `You are an expert school examiner. Create a Multiple-Choice Question (MCQ) Test Paper of exactly 5 questions for Chapter ${chapterIndex}: "${chapterTitle}" based on the following chapter text.

Return a valid JSON object with a single key "questions" containing an array of exactly 5 question objects. Each question object must have:
- "question": the question statement
- "options": an array of exactly 4 strings (representing option choices A, B, C, D)
- "correctIndex": a number from 0 to 3 (0=A, 1=B, 2=C, 3=D) indicating the correct option
- "explanation": a 1-2 sentence explanation of why this option is correct

JSON format:
{
  "questions": [
    {
      "question": "What is the capital of France?",
      "options": ["London", "Berlin", "Paris", "Rome"],
      "correctIndex": 2,
      "explanation": "Paris is the capital and most populous city of France."
    }
  ]
}

Chapter text:
${text}`;
    } else {
      return NextResponse.json({ error: 'Invalid action provided' }, { status: 400 });
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
            content: systemInstruction
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Mistral API error:', errText);
      return NextResponse.json(
        { error: `Mistral API returned an error: ${response.status}` },
        { status: response.status }
      );
    }

    const json = await response.json();
    const rawResult = json.choices?.[0]?.message?.content || '';
    const cleanedResult = cleanJSONString(rawResult);

    try {
      const parsedData = JSON.parse(cleanedResult);
      return NextResponse.json({
        success: true,
        data: parsedData,
      });
    } catch (parseError: any) {
      console.error('Failed to parse AI JSON response:', cleanedResult, parseError);
      return NextResponse.json(
        { error: 'AI generated invalid JSON structure. Please retry.', rawResponse: cleanedResult },
        { status: 502 }
      );
    }

  } catch (error: any) {
    console.error('AI EduTech process error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate materials' },
      { status: 500 }
    );
  }
}
