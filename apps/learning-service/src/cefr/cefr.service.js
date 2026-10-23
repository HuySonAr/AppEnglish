import { AccountRole } from '@appenglish/auth-contracts';
import { MockAttemptKind, PRODUCTIVE_CEFR_RULES, productiveCefr, toeicCefr } from '@appenglish/learning-contracts';
import { placementErrors } from '../placement/placement.errors.js';

const iso = (value) => (value ? new Date(value).toISOString() : null);
const totalOf = (submission) => submission.teacherReview?.scores?.total ?? submission.result?.scores?.total ?? null;

export class CefrService {
  constructor(mockRepository, submissionRepository) {
    this.mockRepository = mockRepository;
    this.submissionRepository = submissionRepository;
  }

  async getProfile(actor) {
    if (actor.role !== AccountRole.STUDENT) throw placementErrors.forbiddenRole();
    const [attempts, submissions] = await Promise.all([
      this.mockRepository.listFinishedAttempts(actor.id),
      this.submissionRepository.listScored(actor.id, [...PRODUCTIVE_CEFR_RULES.speaking.kinds, ...PRODUCTIVE_CEFR_RULES.writing.kinds]),
    ]);
    const latest = attempts.filter((attempt) => attempt.kind === MockAttemptKind.FULL && Number.isFinite(attempt.listeningScore) && Number.isFinite(attempt.readingScore)).at(-1);
    const fromMock = (skill, score) => (latest ? { level: toeicCefr(skill, score), score, at: iso(latest.submittedAt), mockTestId: latest.mockTestId } : { level: null, score: null, at: null, mockTestId: null });
    const productive = (skill) => {
      const rule = PRODUCTIVE_CEFR_RULES[skill];
      const results = submissions
        .filter((submission) => rule.kinds.includes(submission.kind))
        .map((submission) => ({ level: submission.prompt?.level, total: totalOf(submission), at: iso(submission.submittedAt) }))
        .filter((result) => Number.isFinite(result.total));
      return { ...productiveCefr(results, rule), pass: rule.pass, max: rule.max, recent: PRODUCTIVE_CEFR_RULES.recent, needed: PRODUCTIVE_CEFR_RULES.needed };
    };
    return {
      profile: {
        listening: fromMock('listening', latest?.listeningScore),
        reading: fromMock('reading', latest?.readingScore),
        speaking: productive('speaking'),
        writing: productive('writing'),
      },
    };
  }
}
