import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { inMemoryDb } from '@/lib/memoryDb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const subjectId = params.id;

    if (isSupabaseConfigured && supabase) {
      // Fetch Subject details
      const { data: subject, error: subjectError } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', subjectId)
        .single();

      if (!subjectError && subject) {
        // Fetch chapters
        const { data: chapters, error: chaptersError } = await supabase
          .from('chapters')
          .select('*')
          .eq('subject_id', subjectId)
          .order('index', { ascending: true });

        if (!chaptersError && chapters) {
          // Format keys for client-side camelCase compatibility
          const formattedChapters = chapters.map((ch: any) => ({
            id: ch.id,
            subject_id: ch.subject_id,
            index: ch.index,
            title: ch.title,
            contentSummary: ch.content_summary,
            rawTextChunk: ch.raw_text_chunk,
          }));

          return NextResponse.json({
            success: true,
            mode: 'supabase',
            subject,
            chapters: formattedChapters,
          });
        }
      }

      console.warn('Supabase subject fetch failed, falling back to in-memory:', subjectError?.message);
    }

    // In-memory fallback
    const subject = inMemoryDb.subjects.find(sub => sub.id === subjectId);
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    const chapters = inMemoryDb.chapters
      .filter(ch => ch.subject_id === subjectId)
      .sort((a, b) => a.index - b.index)
      .map(ch => ({
        id: ch.id,
        subject_id: ch.subject_id,
        index: ch.index,
        title: ch.title,
        contentSummary: ch.content_summary,
        rawTextChunk: ch.raw_text_chunk,
      }));

    return NextResponse.json({
      success: true,
      mode: 'memory',
      subject,
      chapters,
    });

  } catch (error: any) {
    console.error('Failed to get subject details:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch subject details' }, { status: 500 });
  }
}
