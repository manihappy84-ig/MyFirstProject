'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Dropzone } from '@/components/ui/Dropzone'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'
import { convertPdfToText } from '@/lib/services/converterService'

interface Subject {
  id: string
  name: string
  description: string
  created_at: string
  chaptersCount?: number
}

interface Chapter {
  id?: string
  subject_id?: string
  index: number
  title: string
  contentSummary: string
  rawTextChunk: string
}

interface KeyTerm {
  term: string
  definition: string
}

interface FillBlank {
  sentence: string
  answer: string
}

interface DiscussionQ {
  question: string
  sampleAnswer: string
}

interface WorksheetData {
  summary: string
  keyTerms: KeyTerm[]
  fillInBlanks: FillBlank[]
  discussionQuestions: DiscussionQ[]
}

interface MCQQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

interface TestData {
  id?: string
  questions: MCQQuestion[]
}

type Stage = 'idle' | 'uploading' | 'parsing' | 'ocr_processing' | 'structuring' | 'workspace' | 'error'

export default function StudyBuddyPage() {
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState(0)
  const [stageLabel, setStageLabel] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [error, setError] = useState<string | null>(null)

  // SaaS Database states
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [dbMode, setDbMode] = useState<'supabase' | 'memory' | 'loading'>('loading')
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(true)
  const [uploadMode, setUploadMode] = useState<'pdf' | 'paste'>('pdf')
  const [subjectTitleInput, setSubjectTitleInput] = useState('')
  const [pastedText, setPastedText] = useState('')

  // EduTech structured state
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(1)
  
  // Worksheets & Tests cached by chapter index (1-10)
  const [worksheets, setWorksheets] = useState<Record<number, WorksheetData>>({})
  const [loadingWorksheet, setLoadingWorksheet] = useState<boolean>(false)
  
  const [tests, setTests] = useState<Record<number, TestData>>({})
  const [loadingTest, setLoadingTest] = useState<boolean>(false)

  // Navigation tab inside Workspace right panel
  const [activeTab, setActiveTab] = useState<'worksheet' | 'test' | 'quiz'>('worksheet')

  // Interactive Worksheet State
  const [revealWorksheetAnswers, setRevealWorksheetAnswers] = useState<boolean>(false)
  const [expandedDiscussionQ, setExpandedDiscussionQ] = useState<Record<number, boolean>>({})
  
  // Interactive Fill-in-the-blank guesses
  const [fillBlankGuesses, setFillBlankGuesses] = useState<Record<string, string>>({})
  const [fillBlankFeedback, setFillBlankFeedback] = useState<Record<string, 'correct' | 'incorrect' | null>>({})

  // Interactive Test State
  const [testActive, setTestActive] = useState<boolean>(false)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0)
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState<number | null>(null)
  const [testScore, setTestScore] = useState<number>(0)
  const [testFinished, setTestFinished] = useState<boolean>(false)
  const [showCelebration, setShowCelebration] = useState<boolean>(false)
  const [selectedAnswersLog, setSelectedAnswersLog] = useState<number[]>([])
  const [savingAttempt, setSavingAttempt] = useState<boolean>(false)

  // Interactive Quiz / Flashcards State
  const [activeFlashcardIdx, setActiveFlashcardIdx] = useState<number>(0)
  const [isFlipped, setIsFlipped] = useState<boolean>(false)
  const [quizScore, setQuizScore] = useState<number>(0)
  const [streak, setStreak] = useState<number>(0)
  const [highestStreak, setHighestStreak] = useState<number>(0)

  // Local OCR progress state
  const [ocrProgress, setOcrProgress] = useState({
    stage: 'idle',
    current: 0,
    total: 0,
    percent: 0,
    label: '',
  })

  // Fetch subjects at start
  useEffect(() => {
    fetchSubjects()
  }, [])

  const fetchSubjects = async () => {
    setLoadingSubjects(true)
    try {
      const res = await fetch('/api/study-buddy/subjects')
      const data = await res.json()
      if (data.success) {
        setSubjects(data.subjects || [])
        setDbMode(data.mode)
      } else {
        setError(data.error || 'Failed to list courses from database')
      }
    } catch (err: any) {
      console.error(err)
      setError('Could not connect to the study buddy server endpoint.')
    } finally {
      setLoadingSubjects(false)
    }
  }

  // Select Subject from dashboard catalog
  const selectSubject = async (subject: Subject) => {
    setSelectedSubject(subject)
    setChapters([])
    setWorksheets({})
    setTests({})
    setStage('uploading')
    setStageLabel('Loading course materials from database…')
    setProgress(30)

    try {
      const res = await fetch(`/api/study-buddy/subjects/${subject.id}`)
      const data = await res.json()
      if (data.success) {
        setProgress(70)
        setChapters(data.chapters || [])
        setActiveChapterIndex(1)
        setProgress(100)
        setStage('workspace')
      } else {
        throw new Error(data.error || 'Failed to fetch chapters for this course')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Error occurred loading selected course.')
      setStage('error')
    }
  }

  // PDF Text extraction
  const handleFileSelect = useCallback((f: File) => {
    setFile(f)
    setStage('idle')
    setError(null)
    setChapters([])
    setWorksheets({})
    setTests({})
  }, [])

  const generateOutline = async (rawText: string, titleName: string) => {
    try {
      setStage('structuring')
      setStageLabel('Dividing lesson material into 10 logical chapters…')
      setProgress(60)

      const outlineResponse = await fetch('/api/study-buddy/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: titleName, rawText })
      })

      if (!outlineResponse.ok) {
        throw new Error(`Failed to structure outline: Server returned ${outlineResponse.status}`)
      }

      const outlineData = await outlineResponse.json()
      
      if (outlineData.success && outlineData.subject) {
        setProgress(90)
        await fetchSubjects()
        
        // Load the chapters for this newly generated subject
        const detailRes = await fetch(`/api/study-buddy/subjects/${outlineData.subject.id}`)
        const detailData = await detailRes.json()
        if (detailData.success) {
          setSelectedSubject(outlineData.subject)
          setChapters(detailData.chapters || [])
          setActiveChapterIndex(1)
          setProgress(100)
          setStage('workspace')
        } else {
          throw new Error(detailData.error || 'Failed to load chapters for new subject')
        }
      } else {
        throw new Error(outlineData.error || 'Invalid outline response payload.')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An unexpected error occurred during syllabus outline generation.')
      setStage('error')
    }
  }

  const runClientSideOcr = async () => {
    if (!file) return
    setError(null)
    setStage('ocr_processing')
    setOcrProgress({
      stage: 'loading_pdfjs',
      current: 0,
      total: 0,
      percent: 0,
      label: 'Loading high-accuracy OCR engine…',
    })

    try {
      const pdfjs = await new Promise<any>((resolve, reject) => {
        if ((window as any).pdfjsLib) {
          resolve((window as any).pdfjsLib)
          return
        }
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        script.onload = () => resolve((window as any).pdfjsLib)
        script.onerror = () => reject(new Error('Failed to load local PDF rendering component.'))
        document.body.appendChild(script)
      })

      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

      setOcrProgress((prev) => ({ ...prev, label: 'Reading PDF pages…' }))
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      const total = pdf.numPages

      setOcrProgress((prev) => ({
        ...prev,
        total,
        label: `Parsed document successfully (${total} pages found). Initializing OCR engine…`,
      }))

      const Tesseract = (await import('tesseract.js')).default
      let accumulatedText = ''

      for (let pageNum = 1; pageNum <= total; pageNum++) {
        setOcrProgress((prev) => ({
          ...prev,
          stage: 'rendering_page',
          current: pageNum,
          percent: 0,
          label: `Rendering Page ${pageNum} of ${total} to high-resolution image…`,
        }))

        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: 2.0 })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        canvas.height = viewport.height
        canvas.width = viewport.width

        if (!context) {
          throw new Error('Canvas render context error.')
        }

        await page.render({ canvasContext: context, viewport }).promise
        const dataUrl = canvas.toDataURL('image/png')

        setOcrProgress((prev) => ({
          ...prev,
          stage: 'running_ocr',
          label: `Scanning characters on Page ${pageNum} of ${total}…`,
        }))

        const ocrResult = await Tesseract.recognize(dataUrl, 'eng', {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              const pct = Math.round(m.progress * 100)
              setOcrProgress((prev) => ({
                ...prev,
                percent: pct,
                label: `Scanning characters on Page ${pageNum} of ${total}… (${pct}%)`,
              }))
            }
          },
        })

        accumulatedText += ocrResult.data.text + `\n\n--- Page ${pageNum} Break ---\n\n`
      }

      const finalText = accumulatedText.trim().replace(new RegExp(`\\n\\n--- Page ${total} Break ---\\n\\n$`), '')
      setExtractedText(finalText)

      await generateOutline(finalText, file.name.replace(/\.pdf$/i, ''))
    } catch (err: any) {
      console.error('OCR failed:', err)
      setError(err.message || 'Browser-side OCR extraction failed. Please try again.')
      setStage('error')
    }
  }

  const handleStartProcess = async () => {
    if (!file) return
    setError(null)
    setStage('uploading')
    setStageLabel('Reading your learning material…')
    setProgress(15)

    try {
      setStage('parsing')
      setProgress(35)
      const res = await convertPdfToText(file)
      
      if (res.success && res.data?.text) {
        setExtractedText(res.data.text)
        await generateOutline(res.data.text, file.name.replace(/\.pdf$/i, ''))
      } else if (res.error?.includes('OCR is required') || res.error?.includes('No text could be extracted') || res.error?.includes('422')) {
        await runClientSideOcr()
      } else {
        throw new Error(res.error || 'Failed to extract text from this document. Please verify it contains digital text.')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An unexpected error occurred during processing.')
      setStage('error')
    }
  }

  const handlePasteSubmit = async () => {
    if (!subjectTitleInput.trim()) {
      setError('Please specify a course title')
      return
    }
    if (pastedText.trim().length < 200) {
      setError('Please paste at least 200 characters of notes/textbooks')
      return
    }

    setError(null)
    setStage('uploading')
    setStageLabel('Reading your pasted study notes…')
    setProgress(20)
    setExtractedText(pastedText)

    try {
      await generateOutline(pastedText, subjectTitleInput.trim())
      setPastedText('')
      setSubjectTitleInput('')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to process pasted text notes.')
      setStage('error')
    }
  }

  // Dynamic Loader for active chapter's Worksheet
  const fetchWorksheet = async (chapterIdx: number) => {
    if (worksheets[chapterIdx] || loadingWorksheet) return
    setLoadingWorksheet(true)
    setRevealWorksheetAnswers(false)
    setExpandedDiscussionQ({})
    setFillBlankGuesses({})
    setFillBlankFeedback({})

    const activeCh = chapters.find(c => c.index === chapterIdx)
    const chapterId = activeCh?.id || 'missing-chapter-id'

    try {
      const response = await fetch(`/api/study-buddy/chapters/${chapterId}/worksheet`)
      const result = await response.json()
      if (result.success && result.worksheet) {
        setWorksheets(prev => ({ ...prev, [chapterIdx]: result.worksheet }))
      } else {
        throw new Error(result.error || 'Failed to fetch worksheet')
      }
    } catch (err: any) {
      console.error(err)
      alert(`Could not load worksheet: ${err.message || 'AI generation failed'}`)
    } finally {
      setLoadingWorksheet(false)
    }
  }

  // Dynamic Loader for active chapter's MCQ Test
  const fetchTest = async (chapterIdx: number) => {
    if (tests[chapterIdx] || loadingTest) return
    setLoadingTest(true)
    setTestActive(false)
    setTestFinished(false)
    setCurrentQuestionIdx(0)
    setSelectedAnswerIdx(null)
    setSelectedAnswersLog([])
    setTestScore(0)

    const activeCh = chapters.find(c => c.index === chapterIdx)
    const chapterId = activeCh?.id || 'missing-chapter-id'

    try {
      const response = await fetch(`/api/study-buddy/chapters/${chapterId}/test`)
      const result = await response.json()
      if (result.success && result.test) {
        setTests(prev => ({ ...prev, [chapterIdx]: result.test }))
      } else {
        throw new Error(result.error || 'Failed to fetch test questions')
      }
    } catch (err: any) {
      console.error(err)
      alert(`Could not load test paper: ${err.message || 'AI generation failed'}`)
    } finally {
      setLoadingTest(false)
    }
  }

  // Fetch worksheet/test when tab or active chapter changes
  useEffect(() => {
    if (stage !== 'workspace' || chapters.length === 0) return
    if (activeTab === 'worksheet') {
      fetchWorksheet(activeChapterIndex)
    } else if (activeTab === 'test') {
      fetchTest(activeChapterIndex)
    } else if (activeTab === 'quiz') {
      // Flashcard quiz uses Key Terms from Worksheet
      fetchWorksheet(activeChapterIndex)
    }
  }, [stage, activeChapterIndex, activeTab, chapters])

  // Handles logging student test scores
  const saveTestAttempt = async (finalScore: number, answersLog: number[]) => {
    const activeTestData = tests[activeChapterIndex]
    if (!activeTestData || !activeTestData.id) return

    setSavingAttempt(true)
    try {
      await fetch(`/api/study-buddy/tests/${activeTestData.id}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: finalScore,
          max_score: activeTestData.questions.length,
          selected_answers: answersLog,
        })
      })
    } catch (err) {
      console.error('Failed to save test attempt to database:', err)
    } finally {
      setSavingAttempt(false)
    }
  }

  // Handles clicking options in the test flow
  const handleSelectOption = (idx: number) => {
    if (selectedAnswerIdx !== null) return // already answered
    setSelectedAnswerIdx(idx)

    const activeTestData = tests[activeChapterIndex]
    const currentQuestion = activeTestData?.questions[currentQuestionIdx]
    const newAnswersLog = [...selectedAnswersLog, idx]
    setSelectedAnswersLog(newAnswersLog)

    let isCorrect = false
    if (currentQuestion && idx === currentQuestion.correctIndex) {
      setTestScore(prev => prev + 1)
      isCorrect = true
    }

    if (currentQuestionIdx + 1 === activeTestData?.questions.length) {
      // Last question just answered: save to DB!
      const finalScore = testScore + (isCorrect ? 1 : 0)
      saveTestAttempt(finalScore, newAnswersLog)
    }
  }

  const handleNextQuestion = () => {
    const activeTestData = tests[activeChapterIndex]
    if (!activeTestData) return

    if (currentQuestionIdx + 1 < activeTestData.questions.length) {
      setCurrentQuestionIdx(prev => prev + 1)
      setSelectedAnswerIdx(null)
    } else {
      setTestFinished(true)
      const maxScore = activeTestData.questions.length
      if (testScore >= maxScore - 1) {
        setShowCelebration(true)
        setTimeout(() => setShowCelebration(false), 5000)
      }
    }
  }

  // Flashcards Got it / Needs practice swipe actions
  const handleFlashcardReview = (knowsWord: boolean) => {
    setIsFlipped(false)
    if (knowsWord) {
      setQuizScore(prev => prev + 10)
      const nextStreak = streak + 1
      setStreak(nextStreak)
      if (nextStreak > highestStreak) setHighestStreak(nextStreak)
    } else {
      setStreak(0)
    }

    const currentWorksheet = worksheets[activeChapterIndex]
    const totalCards = currentWorksheet?.keyTerms?.length || 0

    setTimeout(() => {
      if (totalCards > 0) {
        setActiveFlashcardIdx(prev => (prev + 1) % totalCards)
      }
    }, 150)
  }

  // Interactive Fill Blank Checker
  const handleCheckFillBlank = (qIdx: number, userGuess: string, correctAns: string) => {
    const guess = userGuess.trim().toLowerCase()
    const ans = correctAns.trim().toLowerCase()
    const isOk = guess === ans

    setFillBlankFeedback(prev => ({ ...prev, [qIdx]: isOk ? 'correct' : 'incorrect' }))
  }

  const activeChapter = chapters.find(c => c.index === activeChapterIndex)
  const currentWorksheet = worksheets[activeChapterIndex]
  const currentTest = tests[activeChapterIndex]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#132238] to-slate-950 text-white font-sans">
      
      {/* ── Global Celebration Particle Shower ── */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/35 backdrop-blur-[1px] animate-fade-in">
          <div className="text-center bg-slate-900/90 border border-yellow-500/30 p-8 rounded-3xl shadow-2xl relative">
            <span className="text-7xl block mb-4 animate-bounce">🏆</span>
            <h2 className="text-3xl font-extrabold bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent">Perfect Score!</h2>
            <p className="text-gray-300 text-sm mt-2">You crushed this chapter test. Keep it up! 🔥</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition group"
            >
              <svg className="w-5 h-5 group-hover:-translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Home</span>
            </Link>
            <div className="w-px h-5 bg-white/20" />
            <Link href="/" className="flex items-center gap-2">
              <span className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-pink-500 bg-clip-text text-transparent">OCR InfyGalaxy</span>
            </Link>
          </div>

          {/* SaaS Connection Status Indicator */}
          <div>
            {dbMode === 'supabase' && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Cloud Database Active
              </span>
            )}
            {dbMode === 'memory' && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-md" title="Suppressed/No keys found in environment variables. Falling back to sandbox memory.">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Local Sandbox Fallback
              </span>
            )}
            {dbMode === 'loading' && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/5 text-gray-400">
                <Spinner size="sm" color="gray" />
                Detecting persistence...
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">

        {/* Wizard Header (Upload/Processing) */}
        {stage !== 'workspace' && (
          <div className="text-center mb-10 max-w-xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-500 to-pink-500 text-3xl mb-4 shadow-xl shadow-indigo-500/10">
              🎓
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
              AI Study Buddy
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Upload study guides or textbook notes. We partition the material into exactly 10 interactive chapters, worksheets, and custom MCQ exam sheets.
            </p>
          </div>
        )}

        {/* ── STAGE 1: SUBJECT DASHBOARD / UPLOAD SCREEN ── */}
        {stage === 'idle' && (
          <div className="space-y-12 animate-fade-in-up">
            {error && (
              <div className="max-w-2xl mx-auto p-4 bg-red-900/30 border border-red-500/30 text-red-300 rounded-2xl flex gap-3 items-start">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="font-bold text-sm">Operation Failed</h4>
                  <p className="text-xs text-red-400/90 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Saved Subject Grid */}
              <div className="lg:col-span-7 space-y-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>📚</span> Your Saved Courses
                </h2>

                {loadingSubjects ? (
                  <div className="flex flex-col items-center justify-center p-16 bg-white/5 border border-white/10 rounded-3xl">
                    <Spinner size="md" color="purple" />
                    <p className="text-gray-400 text-xs mt-3">Syncing subjects from database...</p>
                  </div>
                ) : subjects.length === 0 ? (
                  <div className="text-center p-16 bg-white/5 border border-white/10 rounded-3xl">
                    <p className="text-gray-400 text-sm">No learning courses configured yet.</p>
                    <p className="text-gray-500 text-xs mt-1">Upload a PDF or paste notes on the right to build your first course!</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {subjects.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => selectSubject(sub)}
                        className="group text-left p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:border-indigo-500/30"
                      >
                        <div className="text-2xl mb-3">📘</div>
                        <h3 className="text-white font-bold text-base truncate group-hover:text-pink-400 transition-colors">
                          {sub.name}
                        </h3>
                        <p className="text-gray-400 text-xs line-clamp-2 mt-1 min-h-[32px]">
                          {sub.description || 'No description provided.'}
                        </p>
                        <div className="flex justify-between items-center mt-5 pt-3 border-t border-white/10 text-[10px] font-bold text-gray-500">
                          <span>{sub.chaptersCount || 0} CHAPTERS LOADED</span>
                          <span className="text-indigo-400 group-hover:translate-x-1 transition-transform">Resume Course →</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Upload Wizard */}
              <div className="lg:col-span-5 bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <span>✨</span> Compile Study Course
                </h2>
                <p className="text-gray-400 text-xs mb-5">Convert notes or books into structured worksheets & test papers.</p>

                {/* Upload Mode Toggle */}
                <div className="flex bg-black/40 border border-white/10 p-1 rounded-xl mb-6">
                  <button
                    onClick={() => { setUploadMode('pdf'); setError(null); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                      uploadMode === 'pdf' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    📄 PDF Document
                  </button>
                  <button
                    onClick={() => { setUploadMode('paste'); setError(null); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                      uploadMode === 'paste' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    ✍️ Paste Notes
                  </button>
                </div>

                {uploadMode === 'pdf' ? (
                  <div>
                    <Dropzone
                      onFileSelect={handleFileSelect}
                      disabled={false}
                      onError={(msg) => setError(msg)}
                    />

                    {file && (
                      <div className="mt-6 space-y-4 animate-fade-in-up">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">📄</span>
                            <div>
                              <p className="text-sm font-semibold truncate max-w-[180px]">{file.name}</p>
                              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setFile(null)}
                            className="text-gray-400 hover:text-white text-xs font-semibold px-3 py-1 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition"
                          >
                            Remove
                          </button>
                        </div>

                        <button
                          onClick={handleStartProcess}
                          className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-pink-600 hover:opacity-95 text-white font-extrabold rounded-2xl text-lg shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5"
                        >
                          Generate Study Suite 🎓
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                        Course / Subject Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Science Revision, History Notes..."
                        value={subjectTitleInput}
                        onChange={(e) => setSubjectTitleInput(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                        Syllabus Text Contents
                      </label>
                      <textarea
                        rows={6}
                        placeholder="Paste study material text here (minimum 200 characters)..."
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 resize-none font-sans"
                      />
                    </div>
                    <button
                      onClick={handlePasteSubmit}
                      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:opacity-95 transition"
                    >
                      Compile Notes
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STAGE 2: PROCESSING SCREEN ── */}
        {(stage === 'uploading' || stage === 'parsing' || stage === 'structuring') && (
          <div className="max-w-xl mx-auto bg-slate-900/60 border border-white/10 rounded-3xl p-10 text-center relative overflow-hidden shadow-2xl glass">
            <div className="absolute -top-20 -left-20 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-pink-500/10 rounded-full blur-3xl" />

            <div className="flex justify-center mb-6">
              <Spinner size="lg" color="purple" />
            </div>

            <h3 className="text-xl font-bold mb-2">{stageLabel}</h3>
            <p className="text-gray-400 text-xs mb-8">AI-powered course generation mapping details...</p>

            <ProgressBar progress={progress} color="purple" />

            {/* Structured Pipeline Timeline */}
            <div className="mt-8 text-left max-w-sm mx-auto space-y-3 pt-6 border-t border-white/5">
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="text-green-400">✓</span>
                <span className="text-gray-300">File uploaded and loaded</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className={stage !== 'uploading' ? 'text-green-400' : 'text-gray-500 animate-pulse'}>
                  {stage !== 'uploading' ? '✓' : '●'}
                </span>
                <span className={stage !== 'uploading' ? 'text-gray-300' : 'text-indigo-400'}>Extracting text pages</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className={stage === 'structuring' ? 'text-indigo-400 animate-pulse' : 'text-gray-500'}>
                  ●
                </span>
                <span className={stage === 'structuring' ? 'text-indigo-400' : 'text-gray-500'}>Dividing into 10 Chapters</span>
              </div>
            </div>
          </div>
        )}

        {/* ── STAGE: OCR PROCESSING SCREEN ── */}
        {stage === 'ocr_processing' && (
          <div className="max-w-xl mx-auto bg-slate-900/60 border border-white/10 rounded-3xl p-10 text-center relative overflow-hidden shadow-2xl glass">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-pink-400 to-indigo-500 animate-scan" />
            
            <div className="flex justify-center mb-6">
              <div className="relative w-16 h-16 flex items-center justify-center bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-3xl shadow-lg animate-pulse">
                🔍
              </div>
            </div>
            <h3 className="text-xl font-bold mb-1">OCR Scan Active</h3>
            <p className="text-pink-400 text-xs font-bold tracking-wider uppercase mb-4">Processing Locally In-Browser</p>
            
            <p className="text-gray-300 text-sm max-w-md mx-auto mb-6">
              {ocrProgress.label}
            </p>

            {ocrProgress.total > 0 && (
              <div className="text-xs text-gray-500 mb-8 font-medium">
                Scanning Page <span className="text-white font-bold">{ocrProgress.current}</span> of <span className="text-white font-bold">{ocrProgress.total}</span>
              </div>
            )}
            
            <div className="max-w-md mx-auto">
              <ProgressBar progress={ocrProgress.percent} color="purple" />
              <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-mono tracking-wider">
                <span>PROGRESS</span>
                <span>{ocrProgress.percent}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ── STAGE: ERROR SCREEN ── */}
        {stage === 'error' && (
          <div className="max-w-md mx-auto bg-slate-900 border border-white/10 rounded-3xl p-8 text-center shadow-xl">
            <span className="text-5xl block mb-4">⚠️</span>
            <h3 className="text-lg font-bold text-white mb-2">Processing Error</h3>
            <p className="text-gray-400 text-xs mb-6 leading-relaxed">
              {error || 'An unexpected server error occurred during text generation.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStage('idle')}
                className="flex-1 py-3 bg-gradient-to-tr from-indigo-500 to-pink-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-indigo-500/15"
              >
                Go Back Home
              </button>
            </div>
          </div>
        )}

        {/* ── STAGE: WORKSPACE ── */}
        {stage === 'workspace' && chapters.length > 0 && (
          <div className="grid lg:grid-cols-12 gap-8 items-start animate-fade-in-up">
            
            {/* Sidebar: 10 Chapters selector */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 shadow-xl">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 px-2">
                  📖 Lesson Chapters
                </h3>
                
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                  {chapters.map((ch) => (
                    <button
                      key={ch.index}
                      onClick={() => {
                        setActiveChapterIndex(ch.index)
                        // Reset test states
                        setTestActive(false)
                        setTestFinished(false)
                      }}
                      className={`w-full text-left p-3 rounded-xl border text-xs font-semibold transition-all flex gap-3 ${
                        activeChapterIndex === ch.index
                          ? 'bg-gradient-to-r from-indigo-500/10 to-pink-500/10 border-indigo-500/40 text-white shadow-md'
                          : 'bg-white/5 border-transparent text-gray-400 hover:text-white hover:bg-white/15'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${
                        activeChapterIndex === ch.index ? 'bg-indigo-500 text-white' : 'bg-white/10 text-gray-400'
                      }`}>
                        {ch.index}
                      </span>
                      <span className="truncate leading-tight mt-0.5">{ch.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Extra Document Details Card */}
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-xs space-y-2 text-gray-400">
                <p className="font-bold text-white mb-1">Course Summary</p>
                <p className="truncate text-gray-300 font-bold">📄 {selectedSubject?.name || 'Manual notes'}</p>
                <button
                  onClick={() => {
                    setSelectedSubject(null)
                    setChapters([])
                    setStage('idle')
                  }}
                  className="w-full mt-2 py-2 border border-white/10 hover:border-white/20 hover:bg-white/5 font-semibold text-white rounded-xl transition"
                >
                  Change Course / Upload
                </button>
              </div>
            </div>

            {/* Left Workspace Panel: Chapter Content Reader */}
            <div className="lg:col-span-5 bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[650px]">
              <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02] flex justify-between items-center">
                <span className="text-xs bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                  Chapter {activeChapterIndex}
                </span>
                <span className="text-gray-400 text-xs">Reader Mode</span>
              </div>

              <div className="p-6 overflow-y-auto flex-1 leading-relaxed text-sm select-text pr-4 custom-scrollbar bg-slate-950/20">
                <h2 className="text-2xl font-extrabold text-white mb-4">
                  {activeChapter?.title}
                </h2>
                
                <p className="text-gray-400 font-medium text-xs border-l-2 border-pink-500 pl-3 py-1 bg-pink-500/5 rounded-r-lg mb-6">
                  {activeChapter?.contentSummary}
                </p>

                <div className="whitespace-pre-wrap font-sans text-gray-300 antialiased space-y-4">
                  {activeChapter?.rawTextChunk ? (
                    activeChapter.rawTextChunk
                  ) : (
                    <div className="py-20 text-center text-gray-500">
                      Chapter excerpt unavailable. Please read worksheet summary.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Workspace Panel: Interactive Study Tabs */}
            <div className="lg:col-span-4 bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[650px] relative">
              
              {/* Tab selector */}
              <div className="grid grid-cols-3 border-b border-white/10 bg-slate-950/50 p-1">
                {[
                  { id: 'worksheet' as const, label: '📄 Worksheet' },
                  { id: 'test' as const, label: '📝 Take Test' },
                  { id: 'quiz' as const, label: '⚡ Quiz' }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`py-3 text-center text-xs font-bold transition-all ${
                      activeTab === t.id
                        ? 'bg-gradient-to-tr from-indigo-500/10 to-pink-500/10 text-white border-b-2 border-indigo-500'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Dynamic study area */}
              <div className="flex-1 overflow-y-auto p-5 relative">
                
                {/* ────── TAB A: WORKSHEETS ────── */}
                {activeTab === 'worksheet' && (
                  <div className="space-y-6 animate-fade-in">
                    {loadingWorksheet && (
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-fade-in">
                        <Spinner size="md" color="purple" />
                        <p className="text-xs text-gray-400 mt-4">Generating worksheet contents with AI…</p>
                      </div>
                    )}

                    {currentWorksheet ? (
                      <>
                        {/* Summary */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Concept Summary</h4>
                          <p className="text-xs text-gray-300 leading-relaxed bg-white/5 border border-white/5 p-3.5 rounded-2xl">
                            {currentWorksheet.summary}
                          </p>
                        </div>

                        {/* Vocabulary key terms */}
                        {currentWorksheet.keyTerms && currentWorksheet.keyTerms.length > 0 && (
                          <div className="space-y-2.5">
                            <h4 className="text-xs font-bold text-pink-400 uppercase tracking-wider">Key Vocabulary</h4>
                            <div className="space-y-2">
                              {currentWorksheet.keyTerms.map((kt, kIdx) => (
                                <div key={kIdx} className="bg-white/5 border border-white/5 hover:border-white/10 p-3.5 rounded-xl transition duration-150">
                                  <div className="font-bold text-white text-xs text-rose-300">{kt.term}</div>
                                  <div className="text-gray-400 text-xs leading-relaxed mt-1">{kt.definition}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Fill in the blanks */}
                        {currentWorksheet.fillInBlanks && currentWorksheet.fillInBlanks.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Fill in the Blanks</h4>
                            <div className="space-y-3.5">
                              {currentWorksheet.fillInBlanks.map((fib, fIdx) => (
                                <div key={fIdx} className="bg-white/[0.02] p-3 rounded-xl border border-white/5 space-y-2">
                                  <p className="text-xs text-gray-300 leading-relaxed font-medium">{fib.sentence}</p>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={fillBlankGuesses[`${activeChapterIndex}-${fIdx}`] || ''}
                                      onChange={(e) => {
                                        const val = e.target.value
                                        setFillBlankGuesses(prev => ({ ...prev, [`${activeChapterIndex}-${fIdx}`]: val }))
                                      }}
                                      placeholder="Type missing term..."
                                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 flex-1"
                                    />
                                    <button
                                      onClick={() => handleCheckFillBlank(fIdx, fillBlankGuesses[`${activeChapterIndex}-${fIdx}`] || '', fib.answer)}
                                      className="px-3 py-1 bg-white/10 hover:bg-white/15 text-[10px] font-bold rounded-lg transition"
                                    >
                                      Check
                                    </button>
                                  </div>
                                  {fillBlankFeedback[`${fIdx}`] === 'correct' && (
                                    <p className="text-emerald-400 text-[10px] font-bold">✓ Correct! Spot on.</p>
                                  )}
                                  {fillBlankFeedback[`${fIdx}`] === 'incorrect' && (
                                    <p className="text-rose-400 text-[10px] font-bold">
                                      ✗ Incorrect. Answer: <span className="underline font-extrabold">{fib.answer}</span>
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Discussion prompts */}
                        {currentWorksheet.discussionQuestions && currentWorksheet.discussionQuestions.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-pink-400 uppercase tracking-wider">Discussion Prompts</h4>
                            <div className="space-y-2">
                              {currentWorksheet.discussionQuestions.map((dq, dIdx) => (
                                <div key={dIdx} className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
                                  <button
                                    onClick={() => setExpandedDiscussionQ(prev => ({ ...prev, [dIdx]: !prev[dIdx] }))}
                                    className="w-full text-left p-3.5 text-xs font-bold text-white hover:bg-white/5 flex justify-between items-center transition"
                                  >
                                    <span>{dq.question}</span>
                                    <span className="text-gray-500 font-mono text-[10px]">
                                      {expandedDiscussionQ[dIdx] ? '▲' : '▼'}
                                    </span>
                                  </button>
                                  {expandedDiscussionQ[dIdx] && (
                                    <div className="p-4 bg-black/15 text-xs text-gray-400 border-t border-white/5 leading-relaxed animate-fade-in">
                                      <strong className="text-gray-300 block text-[9px] uppercase font-bold tracking-wider mb-1">Suggested Model Answer:</strong>
                                      {dq.sampleAnswer}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-20 text-center text-gray-500 text-xs">
                        Worksheet items will load in a moment.
                      </div>
                    )}
                  </div>
                )}

                {/* ────── TAB B: TAKE A TEST ────── */}
                {activeTab === 'test' && (
                  <div className="space-y-6 animate-fade-in">
                    {loadingTest && (
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-fade-in">
                        <Spinner size="md" color="purple" />
                        <p className="text-xs text-gray-400 mt-4">Creating test questions with AI…</p>
                      </div>
                    )}

                    {currentTest ? (
                      <div>
                        {/* 1. Before test start */}
                        {!testActive && !testFinished && (
                          <div className="text-center py-16 space-y-6">
                            <div className="text-5xl">📝</div>
                            <h4 className="text-lg font-bold">Ready to take the Chapter Test?</h4>
                            <p className="text-xs text-gray-400 max-w-xs mx-auto">
                              This test has **5 multiple-choice questions** generated based on this chapter. Score points and test your comprehension!
                            </p>
                            <button
                              onClick={() => {
                                setTestActive(true)
                                setTestFinished(false)
                                setCurrentQuestionIdx(0)
                                setSelectedAnswerIdx(null)
                                setTestScore(0)
                                setSelectedAnswersLog([])
                              }}
                              className="px-6 py-2.5 bg-gradient-to-tr from-indigo-500 to-pink-500 hover:opacity-90 font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/10"
                            >
                              Start Exam Now
                            </button>
                          </div>
                        )}

                        {/* 2. Active MCQ question */}
                        {testActive && !testFinished && (
                          (() => {
                            const q = currentTest.questions[currentQuestionIdx]
                            if (!q) return null

                            return (
                              <div className="space-y-5 animate-fade-in-up">
                                <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold">
                                  <span>QUESTION {currentQuestionIdx + 1} OF 5</span>
                                  <span className="text-indigo-400 font-mono">Score: {testScore}/5</span>
                                </div>

                                <ProgressBar progress={((currentQuestionIdx) / 5) * 100} color="purple" />

                                <h4 className="text-xs font-bold text-white leading-relaxed pt-2">
                                  {q.question}
                                </h4>

                                <div className="grid gap-2.5">
                                  {q.options.map((opt, oIdx) => {
                                    const isSelected = selectedAnswerIdx === oIdx
                                    const isCorrect = oIdx === q.correctIndex
                                    const hasAnswered = selectedAnswerIdx !== null

                                    let btnStyle = 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                                    if (hasAnswered) {
                                      if (isCorrect) {
                                        btnStyle = 'bg-green-500/25 border-green-500/50 text-green-300 font-bold shadow-md shadow-green-500/10'
                                      } else if (isSelected) {
                                        btnStyle = 'bg-red-500/25 border-red-500/50 text-red-300 font-bold'
                                      } else {
                                        btnStyle = 'bg-white/5 border-transparent text-gray-600 cursor-not-allowed'
                                      }
                                    }

                                    return (
                                      <button
                                        key={oIdx}
                                        disabled={hasAnswered}
                                        onClick={() => handleSelectOption(oIdx)}
                                        className={`w-full text-left p-3.5 rounded-xl border text-[11px] leading-relaxed transition flex items-start gap-3 ${btnStyle}`}
                                      >
                                        <span className={`w-5 h-5 rounded-full border flex items-center justify-center font-mono text-[9px] flex-shrink-0 ${
                                          isSelected ? 'border-indigo-400 bg-indigo-500/20 text-white' : 'border-white/20'
                                        }`}>
                                          {String.fromCharCode(65 + oIdx)}
                                        </span>
                                        <span className="mt-0.5">{opt}</span>
                                      </button>
                                    )
                                  })}
                                </div>

                                {selectedAnswerIdx !== null && (
                                  <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl text-[10px] text-gray-400 leading-relaxed animate-fade-in-up mt-4">
                                    <span className="font-bold text-indigo-400 block mb-1">💡 Explanation</span>
                                    {q.explanation}
                                  </div>
                                )}

                                {selectedAnswerIdx !== null && (
                                  <button
                                    onClick={handleNextQuestion}
                                    className="w-full mt-3 py-3 bg-white text-slate-950 hover:bg-gray-100 font-extrabold text-xs rounded-xl shadow-lg transition"
                                  >
                                    {currentQuestionIdx === 4 ? 'Finish Exam' : 'Next Question →'}
                                  </button>
                                )}
                              </div>
                            )
                          })()
                        )}

                        {/* 3. Completed test / Scorecard */}
                        {testFinished && (
                          <div className="text-center py-10 space-y-6 animate-fade-in-up">
                            <div className="text-6xl">🎉</div>
                            <h4 className="text-xl font-bold">Exam Completed!</h4>
                            
                            <div className="inline-block bg-white/5 border border-white/10 rounded-3xl p-6 px-10">
                              <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500 block mb-1">Your Score</span>
                              <span className="text-4xl font-extrabold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">{testScore} / 5</span>
                            </div>

                            <p className="text-xs text-gray-400 max-w-xs mx-auto">
                              {testScore === 5
                                ? 'Flawless score! You are a master of this chapter. 🏆'
                                : testScore >= 3
                                ? 'Great job! You have a solid grasp of this material. 👍'
                                : 'Keep practicing. Read the chapter carefully and try again! 📖'}
                            </p>

                            {savingAttempt && (
                              <p className="text-[10px] text-gray-500 animate-pulse">Saving score attempt to database...</p>
                            )}

                            <div className="flex gap-3 pt-4 max-w-xs mx-auto">
                              <button
                                onClick={() => {
                                  setTestActive(true)
                                  setTestFinished(false)
                                  setCurrentQuestionIdx(0)
                                  setSelectedAnswerIdx(null)
                                  setTestScore(0)
                                  setSelectedAnswersLog([])
                                }}
                                className="flex-1 py-3 bg-gradient-to-tr from-indigo-500 to-pink-500 hover:opacity-90 font-bold text-xs rounded-xl transition"
                              >
                                Retake Test
                              </button>
                              <button
                                onClick={() => {
                                  setTestActive(false)
                                  setTestFinished(false)
                                }}
                                className="flex-1 py-3 border border-white/15 hover:bg-white/5 font-bold text-xs rounded-xl transition"
                              >
                                Close Details
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-20 text-center text-gray-500 text-xs">
                        Test questions will load in a moment.
                      </div>
                    )}
                  </div>
                )}

                {/* ────── TAB C: GAMIFIED QUIZ / FLASHCARDS ────── */}
                {activeTab === 'quiz' && (
                  <div className="space-y-6 animate-fade-in">
                    {loadingWorksheet && (
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-fade-in">
                        <Spinner size="md" color="purple" />
                        <p className="text-xs text-gray-400 mt-4">Loading quiz flashcards…</p>
                      </div>
                    )}

                    {currentWorksheet?.keyTerms && currentWorksheet.keyTerms.length > 0 ? (
                      (() => {
                        const totalTerms = currentWorksheet.keyTerms.length
                        const activeTerm = currentWorksheet.keyTerms[activeFlashcardIdx]

                        if (!activeTerm) return null

                        return (
                          <div className="space-y-6">
                            {/* Quiz Stats Row */}
                            <div className="flex justify-between items-center bg-white/5 border border-white/5 p-3 rounded-2xl text-xs">
                              <div>
                                <span className="text-[10px] text-gray-500 font-bold block">XP SCORE</span>
                                <span className="font-extrabold text-yellow-400">{quizScore} XP</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-gray-500 font-bold block">STREAK</span>
                                <span className="font-extrabold text-pink-500">🔥 {streak} {streak > highestStreak ? '(New High!)' : ''}</span>
                              </div>
                            </div>

                            {/* Perspective Flashcard */}
                            <div className="perspective-1000 w-full h-64 select-none cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                              <div className={`relative w-full h-full duration-500 transform-style-preserve-3d transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
                                
                                {/* CARD FRONT */}
                                <div className="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-[#1b2b48] to-[#121c2c] border border-indigo-500/20 rounded-3xl p-6 flex flex-col justify-between items-center text-center shadow-xl">
                                  <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Question Flashcard {activeFlashcardIdx + 1}/{totalTerms}</span>
                                  <h4 className="text-xl font-black text-white px-4">
                                    What is the definition of: <span className="text-pink-400 block mt-2 text-2xl font-bold">{activeTerm.term}</span>
                                  </h4>
                                  <span className="text-[10px] text-gray-500 font-bold bg-white/5 px-3 py-1 rounded-full">Click card to reveal answer 🔄</span>
                                </div>

                                {/* CARD BACK */}
                                <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-[#2b1b36] to-[#1d1226] border border-pink-500/20 rounded-3xl p-6 flex flex-col justify-between items-center text-center shadow-xl">
                                  <span className="text-[10px] uppercase font-bold tracking-widest text-pink-400">Correct Answer</span>
                                  <p className="text-sm text-gray-200 leading-relaxed font-medium px-4">
                                    {activeTerm.definition}
                                  </p>
                                  <span className="text-[10px] text-gray-500 font-bold bg-white/5 px-3 py-1 rounded-full">Click again to flip back 🔄</span>
                                </div>

                              </div>
                            </div>

                            {/* Flip controls */}
                            <div className="flex gap-4 max-w-xs mx-auto">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleFlashcardReview(true)
                                }}
                                className="flex-1 py-3 bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30 font-bold text-xs rounded-xl shadow-lg transition"
                              >
                                👍 Got It!
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleFlashcardReview(false)
                                }}
                                className="flex-1 py-3 bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 font-bold text-xs rounded-xl shadow-lg transition"
                              >
                                👎 Needs Review
                              </button>
                            </div>

                            <p className="text-center text-[10px] text-gray-500">
                              Highest Streak this session: <span className="font-bold text-gray-300">🔥 {highestStreak}</span>
                            </p>
                          </div>
                        )
                      })()
                    ) : (
                      <div className="py-20 text-center text-gray-500 text-xs">
                        Flashcards will load in a moment.
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

          </div>
        )}

      </main>

      {/* CSS injection for flipping cards and custom scrollbars */}
      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  )
}
