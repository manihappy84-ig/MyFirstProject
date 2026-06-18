import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { inMemoryDb, generateUUID } from '@/lib/memoryDb';

export async function GET() {
  try {
    if (isSupabaseConfigured && supabase) {
      // Fetch subjects along with their chapter counts
      const { data: subjects, error } = await supabase
        .from('subjects')
        .select(`
          id,
          name,
          description,
          created_at,
          chapters (id)
        `)
        .order('created_at', { ascending: false });

      if (!error && subjects) {
        const formatted = subjects.map((sub: any) => ({
          id: sub.id,
          name: sub.name,
          description: sub.description,
          created_at: sub.created_at,
          chaptersCount: sub.chapters?.length || 0,
        }));
        return NextResponse.json({ success: true, mode: 'supabase', subjects: formatted });
      }

      console.warn('Supabase fetch failed or tables not ready, falling back to in-memory:', error?.message);
    }

    const formatted = inMemoryDb.subjects.map(sub => {
      const chaptersCount = inMemoryDb.chapters.filter(ch => ch.subject_id === sub.id).length;
      return {
        ...sub,
        chaptersCount,
      };
    });

    return NextResponse.json({ success: true, mode: 'memory', subjects: formatted });

  } catch (error: any) {
    console.error('Failed to get subjects:', error);
    return NextResponse.json({ error: error.message || 'Failed to list subjects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, chapters, rawText } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Subject name is required' }, { status: 400 });
    }

    let finalChapters = chapters || [];
    let finalDescription = description || '';

    // If rawText is provided, auto-generate the 10 chapters using Mistral AI
    if (rawText && (!chapters || chapters.length === 0)) {
      const apiKey = process.env.MISTRAL_API_KEY || process.env.MISTRAL || process.env.Mistral || process.env.mistral;
      if (apiKey) {
        try {
          const prompt = `You are a curriculum design specialist. Divide the following learning material text into exactly 10 distinct, sequential chapters or sub-sections.
If the text is too short, break it up by logical paragraphs or key concepts.

Return a valid JSON object with a single key "chapters" containing an array of exactly 10 chapter objects. Each object must have:
- "index": a number from 1 to 10
- "title": a short, descriptive chapter title
- "contentSummary": a 2-3 sentence summary of what this chapter covers from the text
- "rawTextChunk": a relevant excerpt or chunk of text from the material that matches this chapter (roughly 1/10th of the input text)

JSON format:
{
  "chapters": [
    { "index": 1, "title": "Chapter Title", "contentSummary": "Summary here...", "rawTextChunk": "excerpt..." }
  ]
}

Learning material:
${rawText.slice(0, 30000)}`;

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
                  content: 'You are a highly capable educational assistant. You output raw JSON strictly conforming to the requested schema. Never output any extra text, conversation, or greetings.'
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

          if (response.ok) {
            const json = await response.json();
            const outline = JSON.parse(json.choices?.[0]?.message?.content || '{}');
            if (outline.chapters && Array.isArray(outline.chapters)) {
              // Map key names to match our PostgreSQL chapters table fields
              finalChapters = outline.chapters.map((ch: any) => ({
                index: ch.index,
                title: ch.title || `Chapter ${ch.index}`,
                content_summary: ch.contentSummary || ch.content_summary || '',
                raw_text_chunk: ch.rawTextChunk || ch.raw_text_chunk || '',
              }));
              finalDescription = `Course generated automatically from uploaded textbook text.`;
            }
          } else {
            console.error('Mistral outline generation failed, status:', response.status);
          }
        } catch (err) {
          console.error('Failed to generate chapters via Mistral, using local partition:', err);
        }
      }

      // If Mistral key is missing or failed, partition the text locally
      if (finalChapters.length === 0) {
        finalChapters = generateLocalChapters(rawText);
        finalDescription = `Interactive study course for ${name}.`;
      }
    }

    if (isSupabaseConfigured && supabase) {
      // 1. Create Subject
      const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .insert([{ name, description: finalDescription }])
        .select()
        .single();

      if (!subjectError && subjectData) {
        const subjectId = subjectData.id;

        // 2. Create Chapters if provided
        if (finalChapters && finalChapters.length > 0) {
          const chaptersToInsert = finalChapters.map((ch: any) => ({
            subject_id: subjectId,
            index: ch.index,
            title: ch.title || `Chapter ${ch.index}`,
            content_summary: ch.content_summary || ch.contentSummary || '',
            raw_text_chunk: ch.raw_text_chunk || ch.rawTextChunk || '',
          }));

          const { error: chaptersError } = await supabase
            .from('chapters')
            .insert(chaptersToInsert);

          if (chaptersError) {
            console.error('Failed to save chapters in Supabase:', chaptersError.message);
            return NextResponse.json({
              error: `Subject created, but failed to save chapters: ${chaptersError.message}`
            }, { status: 500 });
          }
        }

        return NextResponse.json({ success: true, mode: 'supabase', subject: subjectData });
      }

      console.warn('Supabase insert failed, falling back to in-memory mode:', subjectError?.message);
    }

    // In-memory fallback
    const subjectId = generateUUID();
    const newSubject = {
      id: subjectId,
      name,
      description: finalDescription,
      created_at: new Date().toISOString()
    };

    inMemoryDb.subjects.push(newSubject);

    finalChapters.forEach((ch: any) => {
      inMemoryDb.chapters.push({
        id: generateUUID(),
        subject_id: subjectId,
        index: ch.index,
        title: ch.title || `Chapter ${ch.index}`,
        content_summary: ch.content_summary || ch.contentSummary || '',
        raw_text_chunk: ch.raw_text_chunk || ch.rawTextChunk || '',
        created_at: new Date().toISOString()
      });
    });

    return NextResponse.json({ success: true, mode: 'memory', subject: newSubject });

  } catch (error: any) {
    console.error('Failed to create subject:', error);
    return NextResponse.json({ error: error.message || 'Failed to create subject' }, { status: 500 });
  }
}

// Local text partition fallback to generate 10 logical chapters
function generateLocalChapters(text: string) {
  const chapters = [];
  const cleanText = text.trim();
  const chunkLength = Math.max(200, Math.floor(cleanText.length / 10));

  for (let i = 1; i <= 10; i++) {
    const start = (i - 1) * chunkLength;
    const end = i === 10 ? cleanText.length : i * chunkLength;
    let chunk = cleanText.substring(start, end);
    
    if (chunk.length > 1500) {
      chunk = chunk.substring(0, 1500) + '...';
    }

    const firstLine = chunk.split('\n')[0] || '';
    const title = firstLine.trim().length > 5 && firstLine.length < 50
      ? firstLine.trim()
      : `Chapter ${i}: Section Overview`;

    chapters.push({
      index: i,
      title: title,
      content_summary: `This is chapter ${i} covering topics from character offset ${start} to ${end} in the learning material. It outlines the core terminology, mechanisms, and case examples related to this portion of the lesson.`,
      raw_text_chunk: chunk
    });
  }

  return chapters;
}
