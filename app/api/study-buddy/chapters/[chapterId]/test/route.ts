import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { inMemoryDb, generateUUID } from '@/lib/memoryDb';

export async function GET(
  request: NextRequest,
  { params }: { params: { chapterId: string } }
) {
  try {
    const chapterId = params.chapterId;

    // 1. Try to fetch from DB first (Supabase)
    if (isSupabaseConfigured && supabase) {
      // Fetch test
      const { data: test, error: testError } = await supabase
        .from('tests')
        .select('*')
        .eq('chapter_id', chapterId)
        .maybeSingle();

      if (!testError && test) {
        // Fetch questions
        const { data: questions, error: qError } = await supabase
          .from('test_questions')
          .select('*')
          .eq('test_id', test.id);

        if (!qError && questions) {
          // Format cache hit with frontend-compatible key names (camelCase)
          const formatted = {
            id: test.id,
            title: test.title,
            questions: questions.map((q: any) => ({
              id: q.id,
              question: q.question_text,
              options: q.options,
              correctIndex: q.correct_index,
              explanation: q.explanation,
            })),
          };

          return NextResponse.json({ success: true, mode: 'supabase', cache: 'hit', test: formatted });
        }
      }
    }

    // 2. Try to fetch from InMemoryDB
    const cachedTest = inMemoryDb.tests.find(t => t.chapter_id === chapterId);
    if (cachedTest) {
      const questions = inMemoryDb.test_questions.filter(q => q.test_id === cachedTest.id);
      const formatted = {
        id: cachedTest.id,
        title: cachedTest.title,
        questions: questions.map(q => ({
          id: q.id,
          question: q.question_text,
          options: q.options,
          correctIndex: q.correct_index,
          explanation: q.explanation,
        })),
      };

      return NextResponse.json({ success: true, mode: 'memory', cache: 'hit', test: formatted });
    }

    // 3. Cache Miss: Fetch chapter
    let chapterText = '';
    let chapterTitle = '';
    let chapterIndex = 1;

    if (isSupabaseConfigured && supabase) {
      const { data: ch, error: chError } = await supabase
        .from('chapters')
        .select('*')
        .eq('id', chapterId)
        .single();
      if (!chError && ch) {
        chapterText = ch.raw_text_chunk || ch.content_summary;
        chapterTitle = ch.title;
        chapterIndex = ch.index;
      }
    }

    if (!chapterText) {
      // Look in memory
      const ch = inMemoryDb.chapters.find(c => c.id === chapterId);
      if (ch) {
        chapterText = ch.raw_text_chunk || ch.content_summary;
        chapterTitle = ch.title;
        chapterIndex = ch.index;
      }
    }

    if (!chapterText) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // 4. Generate questions via Mistral AI
    const apiKey = process.env.MISTRAL_API_KEY || process.env.MISTRAL || process.env.Mistral || process.env.mistral;
    let testData: {
      questions: Array<{
        question: string;
        options: string[];
        correctIndex: number;
        explanation: string;
      }>;
    };

    if (apiKey) {
      const prompt = `You are an expert school examiner. Create a Multiple-Choice Question (MCQ) Test Paper of exactly 5 questions for Chapter ${chapterIndex}: "${chapterTitle}" based on the following chapter text.

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
${chapterText}`;

      try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            response_format: { type: 'json_object' }
          }),
        });

        if (!response.ok) {
          throw new Error(`Mistral API returned code ${response.status}`);
        }

        const json = await response.json();
        const responseText = json.choices?.[0]?.message?.content || '';
        testData = JSON.parse(responseText);

      } catch (err: any) {
        console.error('Mistral test generation error, using local generator:', err);
        testData = generateMockTest(chapterTitle);
      }
    } else {
      console.warn('Mistral API key not configured. Generating local mock test.');
      testData = generateMockTest(chapterTitle);
    }

    // 5. Store generated content
    let savedTestId = '';
    let savedMode = 'memory';

    if (isSupabaseConfigured && supabase) {
      try {
        // Save test container
        const { data: tData, error: tInsError } = await supabase
          .from('tests')
          .insert([{
            chapter_id: chapterId,
            title: `MCQ Test: ${chapterTitle}`,
          }])
          .select()
          .single();

        if (!tInsError && tData) {
          savedTestId = tData.id;
          savedMode = 'supabase';

          // Insert questions
          const questionRows = testData.questions.map((q) => ({
            test_id: savedTestId,
            question_text: q.question,
            options: q.options,
            correct_index: q.correctIndex,
            explanation: q.explanation,
          }));

          const { error: qInsError } = await supabase
            .from('test_questions')
            .insert(questionRows);

          if (qInsError) {
            console.error('Failed to insert test questions to Supabase:', qInsError.message);
          }
        } else {
          console.error('Failed to insert test to Supabase:', tInsError?.message);
        }
      } catch (dbErr) {
        console.error('Database save error for test, keeping in memory:', dbErr);
      }
    }

    // Fallback/Parallel save in memory if DB didn't save or we are in memory mode
    if (!savedTestId) {
      savedTestId = generateUUID();
      inMemoryDb.tests.push({
        id: savedTestId,
        chapter_id: chapterId,
        title: `MCQ Test: ${chapterTitle}`,
        created_at: new Date().toISOString(),
      });

      testData.questions.forEach((q) => {
        inMemoryDb.test_questions.push({
          id: generateUUID(),
          test_id: savedTestId,
          question_text: q.question,
          options: q.options,
          correct_index: q.correctIndex,
          explanation: q.explanation,
          created_at: new Date().toISOString(),
        });
      });
    }

    // Load final formatted questions
    const finalQuestions = testData.questions.map((q, idx) => ({
      id: `${savedTestId}-q-${idx}`,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    }));

    return NextResponse.json({
      success: true,
      mode: savedMode,
      cache: 'miss',
      test: {
        id: savedTestId,
        title: `MCQ Test: ${chapterTitle}`,
        questions: finalQuestions,
      },
    });

  } catch (error: any) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process test request' }, { status: 500 });
  }
}

// Local mock test builder
function generateMockTest(title: string) {
  const questions = [];
  for (let i = 1; i <= 5; i++) {
    questions.push({
      question: `Question ${i}: What is the primary focus of the discussion in "${title}"?`,
      options: [
        `Option A: Explaining the primary mechanism of study topic ${i}.`,
        `Option B: Describing alternative applications or designs.`,
        `Option C: Reviewing historical data and background.`,
        `Option D: Analyzing the metrics and limitations.`,
      ],
      correctIndex: (i - 1) % 4,
      explanation: `Option ${['A', 'B', 'C', 'D'][(i - 1) % 4]} is correct because the text indicates that this option represents the standard guideline and primary focus of section ${i}.`,
    });
  }

  return {
    questions,
  };
}
