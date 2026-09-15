import { emitReviewed } from "./events";

const BASE = "/api";

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "content-type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  overview: () => req<import("./types").Overview>("/overview"),
  heatmap: (days = 140) => req<{ days: number; rows: { day: string; correct: number; answers: number }[] }>(`/stats/heatmap?days=${days}`),
  settings: () => req<{ daily_goal: number; review_interval_days: number; ai: boolean }>("/settings"),
  saveSettings: (b: { daily_goal?: number; review_interval_days?: number }) => req("/settings", { method: "PUT", body: JSON.stringify(b) }),
  seedDemo: () => req<{ ok: boolean; skipped?: boolean }>("/demo", { method: "POST" }),

  subjects: () => req<import("./types").Subject[]>("/subjects"),
  subject: (id: string) => req<import("./types").SubjectDetail>(`/subjects/${id}`),
  createSubject: (b: { name: string; description?: string; color?: string; emoji?: string }) =>
    req<import("./types").Subject>("/subjects", { method: "POST", body: JSON.stringify(b) }),
  updateSubject: (id: string, b: Partial<import("./types").Subject>) =>
    req<import("./types").Subject>(`/subjects/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteSubject: (id: string) => req(`/subjects/${id}`, { method: "DELETE" }),

  addMaterial: (subjectId: string, b: { title?: string; content?: string; pdfBase64?: string; filename?: string }) =>
    req<{ id: string; status: string }>(`/subjects/${subjectId}/materials`, { method: "POST", body: JSON.stringify(b) }),
  material: (id: string) => req<import("./types").Material>(`/materials/${id}`),
  reprocess: (id: string) => req(`/materials/${id}/reprocess`, { method: "POST" }),
  commitMaterial: (id: string, b: { cards?: number[]; questions?: number[] }) =>
    req<{ ok: boolean; addedCards: number; addedQuestions: number }>(`/materials/${id}/commit`, { method: "POST", body: JSON.stringify(b) }),
  deleteMaterial: (id: string) => req(`/materials/${id}`, { method: "DELETE" }),

  cards: (subjectId: string) => req<import("./types").CardRow[]>(`/subjects/${subjectId}/cards`),
  addCard: (subjectId: string, b: { front: string; back: string; type?: string; hint?: string }) =>
    req(`/subjects/${subjectId}/cards`, { method: "POST", body: JSON.stringify(b) }),
  updateCard: (id: string, b: Record<string, unknown>) => req(`/cards/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteCard: (id: string) => req(`/cards/${id}`, { method: "DELETE" }),

  reviewQueue: (subjectId: string, mode = "flashcards") =>
    req<{ queue: import("./types").ReviewCard[]; intervalDays: number; counts: { due: number } }>(`/subjects/${subjectId}/review/queue?mode=${mode}`),
  review: (cardId: string, b: { rating: number; elapsedMs?: number }) =>
    req<{ ok: boolean; next: string; correct: boolean; streak: number }>(`/cards/${cardId}/review`, { method: "POST", body: JSON.stringify(b) })
      .then((r) => { emitReviewed(); return r; }),

  startSession: (b: { subjectId?: string; mode: string }) => req<{ id: string }>("/sessions", { method: "POST", body: JSON.stringify(b) }),
  endSession: (id: string, b: { cardsSeen: number; correct: number }) => req(`/sessions/${id}`, { method: "PATCH", body: JSON.stringify(b) }),

  questions: (subjectId: string) => req<import("./types").GenQuestion & { id: string }[]>(`/subjects/${subjectId}/questions`),
  makeQuiz: (subjectId: string, b: { size?: number; types?: string[]; title?: string }) =>
    req<{ id: string }>(`/subjects/${subjectId}/quizzes`, { method: "POST", body: JSON.stringify(b) }),
  quiz: (id: string) => req<import("./types").Quiz>(`/quizzes/${id}`),
  checkAnswer: (quizId: string, b: { questionId: string; value: string }) =>
    req<{ correct: boolean; answer: string; explanation: string }>(`/quizzes/${quizId}/check`, { method: "POST", body: JSON.stringify(b) }),
  submitQuiz: (quizId: string, b: { answers: Record<string, string>; checkedIds?: string[]; elapsedMs?: number }) =>
    req<import("./types").AttemptResult>(`/quizzes/${quizId}/attempt`, { method: "POST", body: JSON.stringify(b) }),
  deleteQuiz: (id: string) => req(`/quizzes/${id}`, { method: "DELETE" }),
};
