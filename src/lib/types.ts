export type Subject = {
  id: string;
  name: string;
  description: string;
  color: string;
  emoji: string;
  created_at: string;
};

export type SubjectCounts = {
  cards: number;
  due: number;
  newCards: number;
  learned: number;
  questions: number;
  questionsDue: number;
  mastery: number;
};

export type SubjectOverview = Subject & SubjectCounts;

export type Overview = {
  totals: { subjects: number; cards: number; dueToday: number; reviews7d: number };
  streak: number;
  goal: number;
  todayReviews: number;
  retention: number | null;
  perSubject: SubjectOverview[];
  last30: { day: string; reviews: number; correct: number; new_cards: number; quiz_attempts: number; study_minutes: number }[];
  recentSessions: {
    id: string; mode: string; cards_seen: number; correct: number;
    started_at: string; ended_at: string; subject_name: string | null; emoji: string | null;
  }[];
};

export type GenCard = { type: "basic" | "cloze"; front: string; back: string; hint?: string; origin?: string };
export type GenQuestion = {
  type: "mc" | "truefalse" | "cloze" | "short";
  prompt: string; options: string[]; answer: string; explanation?: string; origin?: string;
};

export type Material = {
  id: string; subjectId: string; title: string;
  status: "pending" | "processing" | "ready" | "committed" | "error";
  lang: string; error: string; createdAt: string; processedAt: string | null; chars: number;
  generated: { cards?: GenCard[]; questions?: GenQuestion[]; lang?: string; stats?: Record<string, number> };
};

export type SubjectDetail = {
  subject: Subject;
  counts: SubjectCounts & { quizzes: number };
  questionsByType: { type: string; n: number }[];
  materials: {
    id: string; title: string; status: Material["status"]; source_type: string; lang: string;
    created_at: string; processed_at: string | null; error: string; chars: number;
  }[];
  quizzes: { id: string; title: string; created_at: string; questions: number; best: string | null }[];
};

export type ReviewCard = {
  id: string; subject_id: string; type: "basic" | "cloze";
  front: string; back: string; hint: string;
  interval: number; reps: number; lapses: number; leech: number;
  due: string;
};

export type CardRow = ReviewCard & {
  created_at: string; stateLabel: string; dueHuman: string; suspended: number; isDue: boolean; due_at: string;
};

export type QuizQuestion = { id: string; type: GenQuestion["type"]; prompt: string; options: string[]; ord: number };
export type Quiz = {
  id: string; title: string; subjectId: string;
  questions: QuizQuestion[];
  attempts: { score: number; total: number; finished_at: string }[];
};
export type AttemptResult = {
  score: number; total: number; pct: number; streak: number;
  detail: { id: string; prompt: string; type: string; given: string; answer: string; explanation: string; correct: boolean }[];
};
