import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  Sparkles,
  Phone,
  PhoneCall,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  TrendingUp,
  ChevronRight,
  LogOut,
  Plus,
  CalendarDays,
  X,
  Send,
  Loader2,
  Settings,
  ShieldCheck,
  MessageCircle,
  Trash2,
} from "lucide-react";

import { api, ApiError } from "../lib/api";
import type {
  Topic,
  ScheduledRecall,
  Misconception,
  RecallSessionSummary,
  RecallSessionDetail,
  SystemStatus,
  Profile,
} from "../lib/api";

type DashboardPageProps = {
  token: string;
  userId: number;
  userName: string;
  onLogout: () => void;
};

export default function DashboardPage({
  token,
  userId,
  userName,
  onLogout,
}: DashboardPageProps) {
  const firstName = userName.split(" ")[0];

  const [topics, setTopics] = useState<Topic[]>([]);
  const [scheduledRecalls, setScheduledRecalls] = useState<ScheduledRecall[]>(
    []
  );
  const [misconceptions, setMisconceptions] = useState<Misconception[]>([]);
  const [recentSessions, setRecentSessions] = useState<
    RecallSessionSummary[]
  >([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const [subjectName, setSubjectName] = useState("");
  const [subjectDescription, setSubjectDescription] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [recallDate, setRecallDate] = useState("");
  const [recallTime, setRecallTime] = useState("");
  const [repeat, setRepeat] = useState("Once");

  const [phoneInput, setPhoneInput] = useState("");
  const [consentInput, setConsentInput] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);

  const [message, setMessage] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  // ------------------------------------------------------------
  // The live recall-call experience (mock or real). null = closed.
  // ------------------------------------------------------------
  const [activeSession, setActiveSession] =
    useState<RecallSessionDetail | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [callBusy, setCallBusy] = useState(false);
  const [callError, setCallError] = useState("");
  const [callModalOpen, setCallModalOpen] = useState(false);

  /*
   * ============================================================
   * LOAD USER DATA
   * ============================================================
   */

  async function loadDashboardData() {
    try {
      setLoadingData(true);

      const [
        subjectsData,
        recallsData,
        misconceptionsData,
        sessionsData,
        statusData,
        meData,
      ] = await Promise.all([
        api.getSubjects(token, userId),
        api.getRecalls(token, userId),
        api.getMisconceptions(token),
        api.getRecallSessions(token),
        api.getSystemStatus(),
        api.getMe(token),
      ]);

      setTopics(subjectsData.subjects || []);
      setScheduledRecalls(recallsData.recalls || []);
      setMisconceptions(misconceptionsData.misconceptions || []);
      setRecentSessions(sessionsData.sessions || []);
      setSystemStatus(statusData);
      setProfile(meData.user);
      setPhoneInput(meData.user.phoneNumber || "");
      setConsentInput(meData.user.callConsent);
    } catch (error) {
      console.error("Dashboard loading error:", error);

      setMessage(
        error instanceof ApiError
          ? error.message
          : "Could not load your memory sky."
      );
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /*
   * ============================================================
   * MEMORY CALCULATIONS
   * ============================================================
   */

  const assessedTopics = topics.filter((topic) => topic.percentage !== null);

  const memoryStrength =
    assessedTopics.length === 0
      ? null
      : Math.round(
          assessedTopics.reduce(
            (total, topic) => total + (topic.percentage || 0),
            0
          ) / assessedTopics.length
        );

  const masteredCount = topics.filter(
    (topic) => topic.status === "Mastered"
  ).length;

  const fadingCount = topics.filter(
    (topic) => topic.status === "Fading"
  ).length;

  const forgottenCount = topics.filter(
    (topic) => topic.status === "Forgotten"
  ).length;

  /*
   * ============================================================
   * ADD SUBJECT
   * ============================================================
   */

  async function handleAddSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = subjectName.trim();
    const cleanDescription = subjectDescription.trim();

    if (!cleanName) {
      return;
    }

    try {
      const data = await api.createSubject(token, {
        name: cleanName,
        description: cleanDescription,
      });

      setTopics((currentTopics) => [...currentTopics, data.subject]);

      setSubjectName("");
      setSubjectDescription("");
      setShowAddSubject(false);

      setMessage(`${cleanName} has been added to your memory sky ☁️`);
    } catch (error) {
      console.error("Add subject error:", error);

      setMessage(
        error instanceof ApiError ? error.message : "Could not connect to Synora."
      );
    }
  }

  /*
   * ============================================================
   * SCHEDULE RECALL
   * ============================================================
   */

  async function handleScheduleRecall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTopic || !recallDate || !recallTime) {
      return;
    }

    const selectedSubject = topics.find(
      (topic) => String(topic.id) === selectedTopic
    );

    if (!selectedSubject) {
      setMessage("Please select a valid subject.");
      return;
    }

    try {
      const data = await api.createRecall(token, {
        subjectId: selectedSubject.id,
        date: recallDate,
        time: recallTime,
        repeat,
      });

      setScheduledRecalls((currentRecalls) => [...currentRecalls, data.recall]);

      setSelectedTopic("");
      setRecallDate("");
      setRecallTime("");
      setRepeat("Once");

      setShowSchedule(false);

      setMessage(`Your ${selectedSubject.name} recall has been scheduled ☁️`);
    } catch (error) {
      console.error("Schedule recall error:", error);

      setMessage(
        error instanceof ApiError ? error.message : "Could not connect to Synora."
      );
    }
  }

  async function handleCancelRecall(recallId: number) {
    try {
      await api.cancelRecall(token, recallId);
      setScheduledRecalls((current) =>
        current.filter((recall) => recall.id !== recallId)
      );
      setMessage("Recall cancelled.");
    } catch (error) {
      setMessage(
        error instanceof ApiError ? error.message : "Could not cancel recall."
      );
    }
  }

  /*
   * ============================================================
   * CALL PREFERENCES / CONSENT
   * ============================================================
   */

  async function handleSaveConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingConsent(true);

    try {
      const data = await api.updateConsent(token, {
        phoneNumber: phoneInput.trim(),
        callConsent: consentInput,
      });

      setProfile((current) =>
        current ? { ...current, ...data.user } as Profile : current
      );

      setShowConsentModal(false);
      setMessage("Call preferences saved.");
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Could not save call preferences."
      );
    } finally {
      setSavingConsent(false);
    }
  }

  /*
   * ============================================================
   * RECALL CALL (mock or real CALL-E)
   * ============================================================
   */

  async function startRecall(subjectId: number, scheduledRecallId?: number) {
    setCallModalOpen(true);
    setCallBusy(true);
    setCallError("");
    setActiveSession(null);

    try {
      const detail = await api.startRecallSession(token, {
        subjectId,
        scheduledRecallId,
      });
      setActiveSession(detail);
    } catch (error) {
      if (error instanceof ApiError && error.data && error.data.session) {
        // The backend still tells us exactly what happened (e.g. real
        // mode not configured) -- show that instead of a bare error.
        setActiveSession(error.data.session as RecallSessionDetail);
      }
      setCallError(
        error instanceof ApiError
          ? error.message
          : "Could not start the recall call."
      );
    } finally {
      setCallBusy(false);
    }
  }

  async function submitAnswer() {
    if (!activeSession || !answerText.trim()) return;

    setCallBusy(true);
    setCallError("");

    try {
      const detail = await api.submitRecallAnswer(
        token,
        activeSession.session.id,
        answerText.trim()
      );
      setActiveSession(detail);
      setAnswerText("");
    } catch (error) {
      setCallError(
        error instanceof ApiError
          ? error.message
          : "Could not send your answer."
      );
    } finally {
      setCallBusy(false);
    }
  }

  function closeRecallModal() {
    const shouldRefresh =
      activeSession?.session.status === "completed" ||
      activeSession?.session.status === "failed";

    setCallModalOpen(false);
    setActiveSession(null);
    setAnswerText("");
    setCallError("");

    if (shouldRefresh) {
      loadDashboardData();
    }
  }

  /*
   * ============================================================
   * DATE FORMAT
   * ============================================================
   */

  function formatDate(date: string) {
    if (!date) {
      return "";
    }

    return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  /*
   * ============================================================
   * LOADING STATE
   * ============================================================
   */

  if (loadingData) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-glow dashboard-glow-one" />
        <div className="dashboard-glow dashboard-glow-two" />

        <div className="dashboard-stars">
          <span>✦</span>
          <span>✧</span>
          <span>✦</span>
          <span>✧</span>
          <span>✦</span>
        </div>

        <div className="dashboard-loading">
          <div className="mini-orb">
            <Brain size={25} />
          </div>

          <h2>Loading your memory sky...</h2>

          <p>Synora is retrieving your memories.</p>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * DASHBOARD
   * ============================================================
   */

  return (
    <main className="dashboard-page">
      <div className="dashboard-glow dashboard-glow-one" />
      <div className="dashboard-glow dashboard-glow-two" />

      <div className="dashboard-stars">
        <span>✦</span>
        <span>✧</span>
        <span>✦</span>
        <span>✧</span>
        <span>✦</span>
      </div>

      <nav className="dashboard-navbar">
        <div className="dashboard-brand">
          <img src="/synora-logo.png" alt="Synora" className="dashboard-logo" />
        </div>

        <div className="dashboard-nav-actions">
          {systemStatus && (
            <div
              className={`mode-badge mode-badge-${systemStatus.callE.mode}`}
              title={
                systemStatus.callE.mode === "mock"
                  ? "Recall calls are simulated -- no real phone call is placed."
                  : "Recall calls are placed through the real CALL-E API."
              }
            >
              <PhoneCall size={12} />
              {systemStatus.callE.mode === "mock" ? "MOCK CALL-E" : "REAL CALL-E"}
            </div>
          )}

          <div className="memory-status-pill">
            <span className="memory-status-dot" />
            {topics.length === 0 ? "Memory sky waiting" : "Memory sky active"}
          </div>

          <button
            className="dashboard-icon-button"
            onClick={() => setShowConsentModal(true)}
            title="Phone & call consent"
          >
            <Settings size={17} />
          </button>

          <button
            className="dashboard-logout"
            onClick={onLogout}
            title="Log out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </nav>

      <section className="dashboard-container">
        <header className="dashboard-welcome">
          <div>
            <div className="dashboard-eyebrow">
              <Sparkles size={14} />
              YOUR MEMORY SKY
            </div>

            <h1>
              Good evening,
              <br />
              <span>{firstName}.</span>
            </h1>

            <p>
              {topics.length === 0
                ? "Your memory sky is waiting for its first subject."
                : "Synora is learning what you remember and where you need help."}
            </p>
          </div>

          <div className="dashboard-cloud-mini">
            <div className="mini-orb">
              <Brain size={25} />
            </div>

            <span>
              {topics.length === 0
                ? "Let's build your memory sky"
                : "Your memories are evolving"}
            </span>
          </div>
        </header>

        {message && <div className="dashboard-message">{message}</div>}

        <section className="dashboard-main-grid">
          <div className="memory-strength-card">
            <div className="card-top-row">
              <div>
                <p className="section-label">OVERALL MEMORY</p>
                <h2>Memory strength</h2>
              </div>

              <TrendingUp size={21} />
            </div>

            <div className="strength-content">
              <div className="memory-orb-area">
                <div className="orb-ring orb-ring-one" />
                <div className="orb-ring orb-ring-two" />

                <div className="dashboard-memory-orb">
                  <strong>{memoryStrength === null ? "?" : memoryStrength}</strong>
                  {memoryStrength !== null && <span>%</span>}
                  <small>{memoryStrength === null ? "waiting" : "strong"}</small>
                </div>
              </div>

              <div className="memory-summary">
                {memoryStrength === null ? (
                  <>
                    <p>
                      Synora hasn't assessed your memory yet. Add a subject
                      and schedule your first recall.
                    </p>

                    <button
                      className="attention-button"
                      onClick={() => setShowAddSubject(true)}
                    >
                      <Plus size={17} />
                      Add your first subject
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      Synora is building a picture of what you remember and
                      what needs attention.
                    </p>

                    <div className="summary-bar">
                      <div
                        className="summary-bar-fill"
                        style={{ width: `${memoryStrength}%` }}
                      />
                    </div>

                    <span>Based on your recall sessions</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="recall-card">
            <div className="recall-cloud-shape" />

            <div className="recall-content">
              <div className="recall-icon">
                <Phone size={25} />
              </div>

              <p className="section-label">READY WHEN YOU ARE</p>

              <h2>
                Time to remember,
                <br />
                not just review.
              </h2>

              <p>
                Synora will ask. You explain. We'll discover what actually
                stayed with you.
              </p>

              <button
                className="start-recall-button"
                onClick={() => {
                  if (topics.length === 0) {
                    setShowAddSubject(true);
                  } else if (topics.length === 1) {
                    startRecall(topics[0].id);
                  } else {
                    setShowSchedule(true);
                  }
                }}
              >
                <span>
                  {topics.length === 0
                    ? "Add a subject to begin"
                    : "Start a recall now"}
                </span>

                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <section className="memory-stats-grid">
          <div className="memory-stat-card">
            <div className="stat-icon mastered-icon">
              <CheckCircle2 size={18} />
            </div>

            <div>
              <strong>{masteredCount}</strong>
              <span>Mastered</span>
            </div>
          </div>

          <div className="memory-stat-card">
            <div className="stat-icon fading-icon">
              <Clock3 size={18} />
            </div>

            <div>
              <strong>{fadingCount}</strong>
              <span>Fading</span>
            </div>
          </div>

          <div className="memory-stat-card">
            <div className="stat-icon forgotten-icon">
              <Brain size={18} />
            </div>

            <div>
              <strong>{forgottenCount}</strong>
              <span>Forgotten</span>
            </div>
          </div>

          <div className="memory-stat-card misconception-card">
            <div className="stat-icon misconception-icon">
              <AlertTriangle size={18} />
            </div>

            <div>
              <strong>{misconceptions.length}</strong>
              <span>Misconceptions</span>
            </div>
          </div>
        </section>

        <section className="dashboard-lower-grid">
          <div className="topics-section dashboard-glass-card">
            <div className="section-heading">
              <div>
                <p className="section-label">YOUR MEMORY MAP</p>
                <h2>Topics in your sky</h2>
              </div>

              <button
                className="text-button"
                onClick={() => setShowAddSubject(true)}
              >
                <Plus size={16} />
                Add subject
              </button>
            </div>

            {topics.length === 0 ? (
              <div className="empty-memory-state">
                <div className="empty-memory-icon">
                  <Brain size={30} />
                </div>

                <h3>Your sky is empty.</h3>

                <p>
                  Add a subject, then let Synora discover what you truly
                  remember.
                </p>

                <button
                  className="attention-button"
                  onClick={() => setShowAddSubject(true)}
                >
                  <Plus size={17} />
                  Add your first subject
                </button>
              </div>
            ) : (
              <div className="topics-list">
                {topics.map((topic) => (
                  <div className="dashboard-topic-card" key={topic.id}>
                    <div className="topic-main">
                      <div className="topic-icon">
                        <Brain size={18} />
                      </div>

                      <div className="topic-info">
                        <div className="topic-name-row">
                          <h3>{topic.name}</h3>

                          <span className={`topic-status ${topic.statusClass}`}>
                            {topic.status}
                          </span>
                        </div>

                        {topic.percentage !== null ? (
                          <div className="topic-progress">
                            <div
                              className="topic-progress-fill"
                              style={{ width: `${topic.percentage}%` }}
                            />
                          </div>
                        ) : (
                          <p className="topic-not-assessed">
                            Synora hasn't tested this yet.
                          </p>
                        )}

                        <div className="topic-meta">
                          <span>Last: {topic.lastReviewed}</span>
                          <span>Next: {topic.nextReview}</span>
                        </div>
                      </div>

                      <div className="topic-actions">
                        <strong className="topic-percentage">
                          {topic.percentage === null ? "—" : `${topic.percentage}%`}
                        </strong>

                        <button
                          className="recall-now-button"
                          onClick={() => startRecall(topic.id)}
                          title={`Start a recall call for ${topic.name}`}
                        >
                          <PhoneCall size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="attention-section">
            <div className="attention-card dashboard-glass-card">
              <div className="attention-top">
                <div>
                  <p className="section-label">NEEDS ATTENTION</p>
                  <h2>What Synora noticed</h2>
                </div>

                <AlertTriangle size={21} />
              </div>

              {misconceptions.length === 0 ? (
                <div className="empty-attention">
                  <p>
                    {topics.length === 0
                      ? "Nothing to assess yet."
                      : "Waiting for your first recall."}
                  </p>

                  <span>
                    {topics.length === 0
                      ? "After your recall sessions, Synora will identify weak concepts and possible misconceptions."
                      : "Complete a recall session and Synora will begin identifying what you understand and where concepts may be getting mixed up."}
                  </span>
                </div>
              ) : (
                <div className="misconception-list">
                  {misconceptions.slice(0, 3).map((item) => (
                    <div className="misconception-box" key={item.id}>
                      <span>{item.subjectName.toUpperCase()}</span>
                      <p>
                        <strong>{item.concept}: </strong>
                        {item.correctUnderstanding}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="recent-card dashboard-glass-card">
              <div className="section-heading">
                <div>
                  <p className="section-label">COMING UP</p>
                  <h2>Scheduled recalls</h2>
                </div>
              </div>

              {scheduledRecalls.length === 0 ? (
                <div className="empty-attention">
                  <p>Nothing scheduled yet.</p>

                  <span>
                    Pick a subject, date and time for Synora to check in
                    with you.
                  </span>

                  <button
                    className="text-button"
                    onClick={() => {
                      if (topics.length === 0) {
                        setShowAddSubject(true);
                      } else {
                        setShowSchedule(true);
                      }
                    }}
                  >
                    <CalendarDays size={16} />
                    Schedule a recall
                  </button>
                </div>
              ) : (
                <div className="scheduled-list">
                  {scheduledRecalls.map((recall) => (
                    <div className="scheduled-recall" key={recall.id}>
                      <div className="recent-icon">
                        <CalendarDays size={18} />
                      </div>

                      <div className="scheduled-recall-info">
                        <strong>{recall.topicName}</strong>

                        <span>
                          {formatDate(recall.date)}
                          {" · "}
                          {recall.time}
                          {" · "}
                          {recall.repeat}
                        </span>
                      </div>

                      <div className="scheduled-recall-actions">
                        <button
                          className="icon-only-button"
                          onClick={() =>
                            startRecall(recall.subjectId, recall.id)
                          }
                          title="Start this recall now"
                        >
                          <PhoneCall size={15} />
                        </button>

                        <button
                          className="icon-only-button"
                          onClick={() => handleCancelRecall(recall.id)}
                          title="Cancel this recall"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="recent-card dashboard-glass-card">
              <div className="section-heading">
                <div>
                  <p className="section-label">RECALL HISTORY</p>
                  <h2>Recent recall results</h2>
                </div>
              </div>

              {recentSessions.length === 0 ? (
                <div className="empty-attention">
                  <p>No recall calls yet.</p>
                  <span>
                    Start a recall from any topic above and your results
                    will show up here.
                  </span>
                </div>
              ) : (
                <div className="scheduled-list">
                  {recentSessions.map((session) => (
                    <div className="scheduled-recall" key={session.id}>
                      <div className="recent-icon">
                        <Brain size={18} />
                      </div>

                      <div className="scheduled-recall-info">
                        <strong>{session.subjectName}</strong>

                        <span>
                          {session.status === "completed"
                            ? session.memoryState
                              ? session.memoryState.charAt(0).toUpperCase() +
                                session.memoryState.slice(1)
                              : "Completed"
                            : session.status === "failed"
                            ? "Call failed"
                            : "In progress"}
                          {session.recallScore !== null &&
                            ` · ${session.recallScore}%`}
                          {" · "}
                          {session.mode === "mock" ? "Mock" : "Real"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </section>

      <div className="dashboard-cloud cloud-dashboard-one" />
      <div className="dashboard-cloud cloud-dashboard-two" />

      {/* ========================================================
          ADD SUBJECT MODAL
          ======================================================== */}

      {showAddSubject && (
        <div className="synora-modal-backdrop">
          <div className="synora-modal">
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowAddSubject(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div className="dashboard-eyebrow">
              <Sparkles size={14} />
              BUILD YOUR MEMORY SKY
            </div>

            <h2>Add a subject</h2>

            <p>Start with something you want Synora to help you remember.</p>

            <form onSubmit={handleAddSubject}>
              <label>
                Subject name

                <input
                  type="text"
                  placeholder="e.g. Computer Networks"
                  value={subjectName}
                  onChange={(event) => setSubjectName(event.target.value)}
                  required
                />
              </label>

              <label>
                Description
                <small>(optional)</small>

                <textarea
                  placeholder="What are you studying?"
                  value={subjectDescription}
                  onChange={(event) =>
                    setSubjectDescription(event.target.value)
                  }
                />
              </label>

              <button type="submit" className="modal-submit">
                <Plus size={18} />
                Add to my memory sky
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          SCHEDULE RECALL MODAL
          ======================================================== */}

      {showSchedule && (
        <div className="synora-modal-backdrop">
          <div className="synora-modal">
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowSchedule(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div className="dashboard-eyebrow">
              <CalendarDays size={14} />
              PLAN YOUR RECALL
            </div>

            <h2>When should Synora check in?</h2>

            <p>Choose a subject, date and time for your recall session.</p>

            <form onSubmit={handleScheduleRecall}>
              <label>
                Subject

                <select
                  value={selectedTopic}
                  onChange={(event) => setSelectedTopic(event.target.value)}
                  required
                >
                  <option value="">Select a subject</option>

                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Date

                <input
                  type="date"
                  value={recallDate}
                  onChange={(event) => setRecallDate(event.target.value)}
                  required
                />
              </label>

              <label>
                Time

                <input
                  type="time"
                  value={recallTime}
                  onChange={(event) => setRecallTime(event.target.value)}
                  required
                />
              </label>

              <label>
                Repeat

                <select
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                >
                  <option value="Once">Once</option>
                  <option value="Daily">Daily</option>
                  <option value="Every 3 days">Every 3 days</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </label>

              <button type="submit" className="modal-submit">
                <CalendarDays size={18} />
                Schedule recall
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          CALL PREFERENCES / CONSENT MODAL
          ======================================================== */}

      {showConsentModal && (
        <div className="synora-modal-backdrop">
          <div className="synora-modal">
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowConsentModal(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div className="dashboard-eyebrow">
              <ShieldCheck size={14} />
              CALL PREFERENCES
            </div>

            <h2>Phone &amp; call consent</h2>

            <p>
              Synora only ever calls you with your explicit permission.
              Real phone calls also require {systemStatus?.callE.mode === "real" ? "this" : "a configured real CALL-E integration and"} phone number below.
            </p>

            <form onSubmit={handleSaveConsent}>
              <label>
                Phone number

                <input
                  type="tel"
                  placeholder="+919876543210"
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                />
              </label>

              <label className="consent-row">
                <input
                  type="checkbox"
                  checked={consentInput}
                  onChange={(event) => setConsentInput(event.target.checked)}
                />

                <span>
                  I agree to receive automated learning recall calls from
                  Synora.
                </span>
              </label>

              <button
                type="submit"
                className="modal-submit"
                disabled={savingConsent}
              >
                <ShieldCheck size={18} />
                {savingConsent ? "Saving..." : "Save preferences"}
              </button>
            </form>

            {profile?.callConsentAt && (
              <p className="consent-timestamp">
                Consent last granted{" "}
                {new Date(profile.callConsentAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          RECALL CALL MODAL (mock typed simulation OR real CALL-E)
          ======================================================== */}

      {callModalOpen && (
        <div className="synora-modal-backdrop">
          <div className="synora-modal recall-call-modal">
            <button
              type="button"
              className="modal-close"
              onClick={closeRecallModal}
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div className="dashboard-eyebrow">
              <PhoneCall size={14} />
              {activeSession?.session.mode === "real"
                ? "REAL CALL-E CALL"
                : "MOCK RECALL CALL"}
            </div>

            <h2>{activeSession?.session.subjectName || "Starting your recall..."}</h2>

            {!activeSession && callBusy && (
              <div className="call-loading">
                <Loader2 size={22} className="spin-icon" />
                <p>Connecting to Synora...</p>
              </div>
            )}

            {activeSession && activeSession.session.status === "failed" && (
              <div className="call-error-box">
                <AlertTriangle size={18} />
                <p>
                  {activeSession.session.failureReason ||
                    "The call could not be completed."}
                </p>
              </div>
            )}

            {activeSession &&
              (activeSession.session.status === "in_progress" ||
                activeSession.session.status === "completed") &&
              activeSession.questions.length > 0 && (
                <div className="call-transcript">
                  {activeSession.questions.map((question) => (
                    <div className="transcript-turn" key={question.id}>
                      <div className="transcript-bubble synora-bubble">
                        <MessageCircle size={14} />
                        <p>{question.text}</p>
                      </div>

                      {question.answerText && (
                        <div className="transcript-bubble learner-bubble">
                          <p>{question.answerText}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            {activeSession &&
              activeSession.session.status === "in_progress" &&
              activeSession.session.mode === "mock" && (
                <form
                  className="call-answer-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitAnswer();
                  }}
                >
                  <textarea
                    placeholder="Type what you'd say out loud on the call..."
                    value={answerText}
                    onChange={(event) => setAnswerText(event.target.value)}
                    required
                  />

                  <button
                    type="submit"
                    className="modal-submit"
                    disabled={callBusy}
                  >
                    <Send size={16} />
                    {callBusy ? "Thinking..." : "Respond"}
                  </button>
                </form>
              )}

            {activeSession &&
              activeSession.session.status === "in_progress" &&
              activeSession.session.mode === "real" && (
                <div className="call-loading">
                  <Loader2 size={22} className="spin-icon" />
                  <p>The call is in progress -- CALL-E is speaking with you now.</p>
                </div>
              )}

            {activeSession &&
              activeSession.session.status === "completed" &&
              activeSession.evaluation && (
                <div className="call-result">
                  <div
                    className={`topic-status result-pill result-${activeSession.evaluation.memoryState}`}
                  >
                    {activeSession.evaluation.memoryState}
                  </div>

                  <p className="call-result-summary">
                    {activeSession.evaluation.summary}
                  </p>

                  {activeSession.evaluation.misconceptions.map((item, index) => (
                    <div className="misconception-box" key={index}>
                      <span>MISCONCEPTION DETECTED</span>
                      <p>
                        <strong>{item.concept}: </strong>
                        {item.correct_understanding}
                      </p>
                    </div>
                  ))}

                  <div className="call-result-meta">
                    <span>Recall score: {activeSession.evaluation.recallScore}%</span>
                    <span>
                      Next review: {activeSession.session.subjectNextReview}
                    </span>
                  </div>

                  <button className="modal-submit" onClick={closeRecallModal}>
                    <CheckCircle2 size={18} />
                    Done
                  </button>
                </div>
              )}

            {callError && <p className="signup-message">{callError}</p>}
          </div>
        </div>
      )}
    </main>
  );
}
