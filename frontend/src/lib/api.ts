export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

export type Topic = {
  id: number;
  name: string;
  description: string;
  percentage: number | null;
  status: string;
  statusClass: string;
  lastReviewed: string;
  nextReview: string;
};

export type ScheduledRecall = {
  id: number;
  subjectId: number;
  topicName: string;
  date: string;
  time: string;
  repeat: string;
};

export type Misconception = {
  id: number;
  concept: string;
  studentBelief: string;
  correctUnderstanding: string;
  evidenceFromResponse: string;
  resolved: number;
  createdAt: string;
  subjectId: number;
  subjectName: string;
};

export type RecallSessionSummary = {
  id: number;
  status: "scheduled" | "calling" | "in_progress" | "completed" | "failed" | "cancelled";
  mode: "mock" | "real";
  createdAt: string;
  subjectId: number;
  subjectName: string;
  recallScore: number | null;
  evaluationStatus: string | null;
  memoryState: string | null;
  summary: string | null;
};

export type EvaluationResult = {
  recallScore: number;
  status: string;
  understanding: string;
  memoryState: "mastered" | "fading" | "forgotten" | "misconception";
  conceptsRemembered: string[];
  weakAreas: string[];
  misconceptions: {
    concept: string;
    student_belief: string;
    correct_understanding: string;
    evidence_from_response: string;
  }[];
  confidence: string;
  summary: string;
  followUpQuestion: string | null;
  recommendedNextReview: string;
  evaluatorMode: string;
};

export type RecallSessionDetail = {
  session: {
    id: number;
    status: string;
    mode: "mock" | "real";
    failureReason: string | null;
    createdAt: string;
    endedAt: string | null;
    subjectId: number;
    subjectName: string;
    subjectPercentage: number | null;
    subjectStatus: string;
    subjectStatusClass: string;
    subjectNextReview: string;
  };
  questions: {
    id: number;
    sequence: number;
    text: string;
    answerText: string | null;
  }[];
  evaluation: EvaluationResult | null;
};

export type SystemStatus = {
  callE: { mode: "mock" | "real"; realAdapterConfigured: boolean };
  evaluator: { mode: "deterministic" | "llm"; llmConfigured: boolean };
};

export type Profile = {
  id: number;
  name: string;
  email: string;
  phoneNumber: string | null;
  callConsent: boolean;
  callConsentAt: string | null;
};

class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // no body
  }

  if (!response.ok) {
    throw new ApiError(
      (data && data.message) || "Something went wrong. Please try again.",
      response.status,
      data
    );
  }

  return data as T;
}

export const api = {
  signup: (body: {
    name: string;
    email: string;
    password: string;
    phoneNumber?: string;
    callConsent?: boolean;
  }) =>
    request<{ token: string; user: { id: number; name: string; email: string } }>(
      "/api/auth/signup",
      { method: "POST", body }
    ),

  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: { id: number; name: string; email: string } }>(
      "/api/auth/login",
      { method: "POST", body }
    ),

  logout: (token: string) =>
    request<{ message: string }>("/api/auth/logout", { method: "POST", token }),

  getMe: (token: string) => request<{ user: Profile }>("/api/users/me", { token }),

  updateConsent: (
    token: string,
    body: { phoneNumber: string; callConsent: boolean }
  ) =>
    request<{ message: string; user: Partial<Profile> }>(
      "/api/users/me/consent",
      { method: "PATCH", token, body }
    ),

  getSystemStatus: () => request<SystemStatus>("/api/system/status"),

  getSubjects: (token: string, userId: number) =>
    request<{ subjects: Topic[] }>(`/api/subjects/${userId}`, { token }),

  createSubject: (token: string, body: { name: string; description: string }) =>
    request<{ subject: Topic }>("/api/subjects", { method: "POST", token, body }),

  getRecalls: (token: string, userId: number) =>
    request<{ recalls: ScheduledRecall[] }>(`/api/recalls/${userId}`, { token }),

  createRecall: (
    token: string,
    body: { subjectId: number; date: string; time: string; repeat: string }
  ) =>
    request<{ recall: ScheduledRecall }>("/api/recalls", {
      method: "POST",
      token,
      body,
    }),

  cancelRecall: (token: string, recallId: number) =>
    request<{ message: string }>(`/api/recalls/${recallId}`, {
      method: "DELETE",
      token,
    }),

  getMisconceptions: (token: string) =>
    request<{ misconceptions: Misconception[] }>("/api/misconceptions", {
      token,
    }),

  getRecallSessions: (token: string) =>
    request<{ sessions: RecallSessionSummary[] }>("/api/recall-sessions", {
      token,
    }),

  startRecallSession: (
    token: string,
    body: { subjectId: number; scheduledRecallId?: number }
  ) =>
    request<RecallSessionDetail>("/api/recall-sessions", {
      method: "POST",
      token,
      body,
    }),

  submitRecallAnswer: (token: string, sessionId: number, answerText: string) =>
    request<RecallSessionDetail>(`/api/recall-sessions/${sessionId}/answer`, {
      method: "POST",
      token,
      body: { answerText },
    }),
};

export { ApiError };
