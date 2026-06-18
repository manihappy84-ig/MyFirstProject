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
      // Fetch worksheet
      const { data: worksheet, error: wsError } = await supabase
        .from('worksheets')
        .select('*')
        .eq('chapter_id', chapterId)
        .maybeSingle();

      if (!wsError && worksheet) {
        // Fetch questions
        const { data: questions, error: qError } = await supabase
          .from('worksheet_questions')
          .select('*')
          .eq('worksheet_id', worksheet.id);

        if (!qError && questions) {
          // Format cache hit
          const formatted = {
            id: worksheet.id,
            summary: worksheet.summary,
            keyTerms: questions.filter((q: any) => q.type === 'key_term').map((q: any) => ({
              term: q.question_text,
              definition: q.answer_text,
            })),
            fillInBlanks: questions.filter((q: any) => q.type === 'fill_blank').map((q: any) => ({
              sentence: q.question_text,
              answer: q.answer_text,
            })),
            discussionQuestions: questions.filter((q: any) => q.type === 'discussion').map((q: any) => ({
              question: q.question_text,
              sampleAnswer: q.answer_text,
            })),
          };

          return NextResponse.json({ success: true, mode: 'supabase', cache: 'hit', worksheet: formatted });
        }
      }
    }

    // 2. Try to fetch from InMemoryDB
    const cachedWorksheet = inMemoryDb.worksheets.find(w => w.chapter_id === chapterId);
    if (cachedWorksheet) {
      const questions = inMemoryDb.worksheet_questions.filter(q => q.worksheet_id === cachedWorksheet.id);
      const formatted = {
        id: cachedWorksheet.id,
        summary: cachedWorksheet.summary,
        keyTerms: questions.filter(q => q.type === 'key_term').map(q => ({
          term: q.question_text,
          definition: q.answer_text,
        })),
        fillInBlanks: questions.filter(q => q.type === 'fill_blank').map(q => ({
          sentence: q.question_text,
          answer: q.answer_text,
        })),
        discussionQuestions: questions.filter(q => q.type === 'discussion').map(q => ({
          question: q.question_text,
          sampleAnswer: q.answer_text,
        })),
      };

      return NextResponse.json({ success: true, mode: 'memory', cache: 'hit', worksheet: formatted });
    }

    // 3. Cache Miss: Fetch chapter to generate worksheet
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

    // 4. Generate content via Mistral AI
    const apiKey = process.env.MISTRAL_API_KEY || process.env.MISTRAL || process.env.Mistral || process.env.mistral;
    let worksheetData: {
      summary: string;
      keyTerms: Array<{ term: string; definition: string }>;
      fillInBlanks: Array<{ sentence: string; answer: string }>;
      discussionQuestions: Array<{ question: string; sampleAnswer: string }>;
    };

    if (apiKey) {
      const prompt = `You are an expert school teacher. Create a comprehensive, engaging learning worksheet for Chapter ${chapterIndex}: "${chapterTitle}" based on the following chapter text.

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
        worksheetData = JSON.parse(responseText);

      } catch (err: any) {
        console.error('Mistral generation error for worksheet, using local generator:', err);
        worksheetData = generateMockWorksheet(chapterTitle);
      }
    } else {
      console.warn('Mistral API key not configured. Generating high-quality local mock worksheet.');
      worksheetData = generateMockWorksheet(chapterTitle);
    }

    // 5. Store generated content
    let savedWorksheetId = '';
    let savedMode = 'memory';

    if (isSupabaseConfigured && supabase) {
      try {
        // Save to worksheets table
        const { data: wsData, error: wsInsError } = await supabase
          .from('worksheets')
          .insert([{
            chapter_id: chapterId,
            title: `Worksheet: ${chapterTitle}`,
            summary: worksheetData.summary,
          }])
          .select()
          .single();

        if (!wsInsError && wsData) {
          savedWorksheetId = wsData.id;
          savedMode = 'supabase';

          // Prepare question rows
          const questionRows: any[] = [];
          
          worksheetData.keyTerms.forEach((kt) => {
            questionRows.push({
              worksheet_id: savedWorksheetId,
              type: 'key_term',
              question_text: kt.term,
              answer_text: kt.definition,
            });
          });

          worksheetData.fillInBlanks.forEach((fib) => {
            questionRows.push({
              worksheet_id: savedWorksheetId,
              type: 'fill_blank',
              question_text: fib.sentence,
              answer_text: fib.answer,
            });
          });

          worksheetData.discussionQuestions.forEach((dq) => {
            questionRows.push({
              worksheet_id: savedWorksheetId,
              type: 'discussion',
              question_text: dq.question,
              answer_text: dq.sampleAnswer,
            });
          });

          const { error: qInsError } = await supabase
            .from('worksheet_questions')
            .insert(questionRows);

          if (qInsError) {
            console.error('Failed to insert worksheet questions to Supabase:', qInsError.message);
          }
        } else {
          console.error('Failed to insert worksheet to Supabase:', wsInsError?.message);
        }
      } catch (dbErr) {
        console.error('Database save error for worksheet, keeping in memory:', dbErr);
      }
    }

    // Fallback/Parallel save in memory if DB didn't save or we are in memory mode
    if (!savedWorksheetId) {
      savedWorksheetId = generateUUID();
      inMemoryDb.worksheets.push({
        id: savedWorksheetId,
        chapter_id: chapterId,
        title: `Worksheet: ${chapterTitle}`,
        summary: worksheetData.summary,
        created_at: new Date().toISOString(),
      });

      worksheetData.keyTerms.forEach((kt) => {
        inMemoryDb.worksheet_questions.push({
          id: generateUUID(),
          worksheet_id: savedWorksheetId,
          type: 'key_term',
          question_text: kt.term,
          answer_text: kt.definition,
          created_at: new Date().toISOString(),
        });
      });

      worksheetData.fillInBlanks.forEach((fib) => {
        inMemoryDb.worksheet_questions.push({
          id: generateUUID(),
          worksheet_id: savedWorksheetId,
          type: 'fill_blank',
          question_text: fib.sentence,
          answer_text: fib.answer,
          created_at: new Date().toISOString(),
        });
      });

      worksheetData.discussionQuestions.forEach((dq) => {
        inMemoryDb.worksheet_questions.push({
          id: generateUUID(),
          worksheet_id: savedWorksheetId,
          type: 'discussion',
          question_text: dq.question,
          answer_text: dq.sampleAnswer,
          created_at: new Date().toISOString(),
        });
      });
    }

    return NextResponse.json({
      success: true,
      mode: savedMode,
      cache: 'miss',
      worksheet: {
        id: savedWorksheetId,
        ...worksheetData,
      },
    });

  } catch (error: any) {
    console.error('Worksheet endpoint error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process worksheet request' }, { status: 500 });
  }
}

// Local mock worksheet builder
function generateMockWorksheet(title: string) {
  return {
    summary: `This is a comprehensive review worksheet covering the key components and theoretical concepts introduced in the lesson on ${title}.`,
    keyTerms: [
      { term: 'Key Concept A', definition: 'The primary mechanism or theoretical pillar supporting this lesson.' },
      { term: 'Vocabulary Term B', definition: 'A critical vocabulary term used to explain the chapter context.' },
      { term: 'Core Framework C', definition: 'The structural system or guideline containing all principles of this topic.' }
    ],
    fillInBlanks: [
      { sentence: 'The main component that initializes the system is known as the _______.', answer: 'framework' },
      { sentence: 'When measuring results, we must evaluate the _______.', answer: 'effect' },
      { sentence: 'A critical pillar supporting the entire chapter is _______.', answer: 'concept' }
    ],
    discussionQuestions: [
      { question: 'Explain the core significance of the ideas described in this chapter.', sampleAnswer: 'This chapter details how standard structures operate, which increases efficiency and forms a foundational base for future learnings.' },
      { question: 'How would you explain these concepts to a complete beginner?', sampleAnswer: 'Break it down into small modules, focusing on the key terms first before attempting the exercises.' }
    ],
  };
}
