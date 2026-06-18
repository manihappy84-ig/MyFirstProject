import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { inMemoryDb, generateUUID } from '@/lib/memoryDb';

export async function POST(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
  try {
    const testId = params.testId;
    const { score, max_score, selected_answers } = await request.json();

    if (score === undefined || max_score === undefined || !selected_answers) {
      return NextResponse.json({ error: 'Missing required parameters (score, max_score, selected_answers)' }, { status: 400 });
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('student_test_attempts')
        .insert([{
          test_id: testId,
          score,
          max_score,
          selected_answers
        }])
        .select()
        .single();

      if (!error && data) {
        return NextResponse.json({ success: true, mode: 'supabase', attempt: data });
      }

      console.warn('Supabase insert attempt failed, falling back to in-memory:', error?.message);
    }

    // In-memory fallback
    const attempt = {
      id: generateUUID(),
      test_id: testId,
      score,
      max_score,
      selected_answers,
      created_at: new Date().toISOString()
    };

    inMemoryDb.student_test_attempts.push(attempt);

    return NextResponse.json({ success: true, mode: 'memory', attempt });

  } catch (error: any) {
    console.error('Failed to log test attempt:', error);
    return NextResponse.json({ error: error.message || 'Failed to save test attempt' }, { status: 500 });
  }
}
