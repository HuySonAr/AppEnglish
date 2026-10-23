import { httpClient } from '../../../lib/api/http-client.js';

export async function listUnits() {
  return (await httpClient.get('/content/units')).data;
}
export async function createUnit(payload) {
  return (await httpClient.post('/content/units', payload)).data;
}
export async function updateUnit(id, payload) {
  return (await httpClient.patch(`/content/units/${id}`, payload)).data;
}
export async function publishUnit(id) {
  return (await httpClient.post(`/content/units/${id}/publish`)).data;
}
// Version history (D122): kind is a ContentVersionKind, id the lesson, mock
// test, exercise, course item or unit.
export async function listContentVersions(kind, id) {
  return (await httpClient.get(`/content/versions/${kind}/${id}`)).data;
}
export async function getContentVersion(kind, id, versionId) {
  return (await httpClient.get(`/content/versions/${kind}/${id}/${versionId}`)).data;
}
export async function restoreContentVersion(kind, id, versionId) {
  return (await httpClient.post(`/content/versions/${kind}/${id}/${versionId}/restore`)).data;
}
// Throws the draft away with the files only it used (D127).
export async function discardContentDraft(kind, id) {
  return (await httpClient.delete(`/content/versions/${kind}/${id}/draft`)).data;
}
// Removes an old version with the files only it used (D128); refused while
// learner attempts refer to it.
export async function deleteContentVersion(kind, id, versionId) {
  return (await httpClient.delete(`/content/versions/${kind}/${id}/${versionId}`)).data;
}
// The review that closes a unit (D121): draft and published version.
export async function getUnitReview(unitId) {
  return (await httpClient.get(`/content/units/${unitId}/review`)).data;
}
export async function saveUnitReviewDraft(unitId, content) {
  return (await httpClient.put(`/content/units/${unitId}/review/draft`, content)).data;
}
export async function publishUnitReview(unitId) {
  return (await httpClient.post(`/content/units/${unitId}/review/publish`)).data;
}
export async function unpublishUnitReview(unitId) {
  return (await httpClient.post(`/content/units/${unitId}/review/unpublish`)).data;
}
export async function createLesson(unitId, payload) {
  return (await httpClient.post(`/content/units/${unitId}/lessons`, payload)).data;
}
export async function updateLesson(id, payload) {
  return (await httpClient.patch(`/content/lessons/${id}`, payload)).data;
}
export async function getLesson(id) {
  return (await httpClient.get(`/content/lessons/${id}`)).data;
}
export async function saveLessonDraft(id, content) {
  return (await httpClient.put(`/content/lessons/${id}/draft`, content)).data;
}
export async function publishLesson(id) {
  return (await httpClient.post(`/content/lessons/${id}/publish`)).data;
}
export async function listMockTests() {
  return (await httpClient.get('/content/mock-tests')).data;
}
export async function createMockTest(payload) {
  return (await httpClient.post('/content/mock-tests', payload)).data;
}
export async function updateMockTest(id, payload) {
  return (await httpClient.patch(`/content/mock-tests/${id}`, payload)).data;
}
export async function getMockTest(id) {
  return (await httpClient.get(`/content/mock-tests/${id}`)).data;
}
// A full mock test is a large draft; give it time.
export async function saveMockTestDraft(id, content) {
  return (await httpClient.put(`/content/mock-tests/${id}/draft`, content, { timeout: 30000 })).data;
}
export async function publishMockTest(id) {
  return (await httpClient.post(`/content/mock-tests/${id}/publish`, undefined, { timeout: 30000 })).data;
}
export async function getMockStats(id) {
  return (await httpClient.get(`/mock-tests/${id}/stats`)).data;
}
export async function requestMockTranscribe(id, audioMediaId) {
  return (await httpClient.post(`/content/mock-tests/${id}/transcribe`, { audioMediaId })).data;
}
export async function listMockTranscribe(id) {
  return (await httpClient.get(`/content/mock-tests/${id}/transcribe`)).data;
}
// Listening exercises (F05B-2, D85).
export async function listListeningExercises() {
  return (await httpClient.get('/content/listening-exercises')).data;
}
export async function createListeningExercise(payload) {
  return (await httpClient.post('/content/listening-exercises', payload)).data;
}
export async function updateListeningExercise(id, payload) {
  return (await httpClient.patch(`/content/listening-exercises/${id}`, payload)).data;
}
export async function getListeningExercise(id) {
  return (await httpClient.get(`/content/listening-exercises/${id}`)).data;
}
export async function saveListeningExerciseDraft(id, content) {
  return (await httpClient.put(`/content/listening-exercises/${id}/draft`, content)).data;
}
export async function publishListeningExercise(id) {
  return (await httpClient.post(`/content/listening-exercises/${id}/publish`)).data;
}
// Auto-time (D97): ask speech-service for the times of the saved lines, then
// read the latest job until it is done.
export async function requestListeningAutoTime(id) {
  return (await httpClient.post(`/content/listening-exercises/${id}/auto-time`)).data;
}
// Transcribe (D98): the lines and their times from the recording alone; read
// with getListeningAutoTime like an auto-time job.
export async function requestListeningTranscribe(id) {
  return (await httpClient.post(`/content/listening-exercises/${id}/transcribe`)).data;
}
export async function getListeningAutoTime(id) {
  return (await httpClient.get(`/content/listening-exercises/${id}/auto-time`)).data;
}
// Listening course (F05C, D100): units and level tests of each CEFR level.
export async function listListeningCourse() {
  return (await httpClient.get('/content/listening-course')).data;
}
export async function createCourseItem(payload) {
  return (await httpClient.post('/content/listening-course/items', payload)).data;
}
export async function updateCourseItem(id, payload) {
  return (await httpClient.patch(`/content/listening-course/items/${id}`, payload)).data;
}
export async function getCourseItem(id) {
  return (await httpClient.get(`/content/listening-course/items/${id}`)).data;
}
export async function saveCourseItemDraft(id, content) {
  return (await httpClient.put(`/content/listening-course/items/${id}/draft`, content, { timeout: 30000 })).data;
}
// D147: Auto-time and Transcribe on a topic's own recording, read back with
// getCourseAutoTime.
export async function requestCourseAutoTime(id) {
  return (await httpClient.post(`/content/listening-course/items/${id}/auto-time`)).data;
}
export async function requestCourseTranscribe(id) {
  return (await httpClient.post(`/content/listening-course/items/${id}/transcribe`)).data;
}
export async function getCourseAutoTime(id) {
  return (await httpClient.get(`/content/listening-course/items/${id}/auto-time`)).data;
}
export async function publishCourseItem(id) {
  return (await httpClient.post(`/content/listening-course/items/${id}/publish`, undefined, { timeout: 30000 })).data;
}
export async function getPlacementTest() {
  return (await httpClient.get('/content/placement')).data;
}
export async function savePlacementDraft(content) {
  return (await httpClient.put('/content/placement/draft', content)).data;
}
export async function publishPlacementTest() {
  return (await httpClient.post('/content/placement/publish')).data;
}
export async function autofillPronunciation(word, accents, lessonId) {
  // Generating the phonetic and both recordings can take a while.
  return (await httpClient.post('/content/pronunciation', { word, accents, lessonId }, { timeout: 90000 })).data;
}
// The server keeps a file a saved version still uses; see deleted in the reply.
export async function deleteMedia(id) {
  return (await httpClient.delete(`/content/media/${id}`)).data;
}
// lessonId and section (vocabulary/test) decide the storage folder.
export async function uploadMedia({ kind, file, lessonId, section }) {
  const form = new FormData();
  form.set('kind', kind);
  if (lessonId) form.set('lessonId', lessonId);
  form.set('section', section);
  form.set('file', file);
  // Uploads can be large; the default 5s client timeout is too short.
  return (await httpClient.post('/content/media', form, { timeout: 180000 })).data;
}

// Taking content away (D118): unpublish hides it from learners, delete removes
// it and is refused (409 CONTENT_IN_USE) while learners have results for it.
export async function unpublishUnit(id) {
  return (await httpClient.post(`/content/units/${id}/unpublish`)).data;
}
export async function deleteUnit(id) {
  return (await httpClient.delete(`/content/units/${id}`)).data;
}
export async function unpublishLesson(id) {
  return (await httpClient.post(`/content/lessons/${id}/unpublish`)).data;
}
export async function deleteLesson(id) {
  return (await httpClient.delete(`/content/lessons/${id}`)).data;
}
export async function unpublishMockTest(id) {
  return (await httpClient.post(`/content/mock-tests/${id}/unpublish`)).data;
}
export async function deleteMockTest(id) {
  return (await httpClient.delete(`/content/mock-tests/${id}`)).data;
}
export async function unpublishListeningExercise(id) {
  return (await httpClient.post(`/content/listening-exercises/${id}/unpublish`)).data;
}
export async function deleteListeningExercise(id) {
  return (await httpClient.delete(`/content/listening-exercises/${id}`)).data;
}
export async function unpublishCourseItem(id) {
  return (await httpClient.post(`/content/listening-course/items/${id}/unpublish`)).data;
}
export async function deleteCourseItem(id) {
  return (await httpClient.delete(`/content/listening-course/items/${id}`)).data;
}
// Files no saved version refers to (D118).
export async function listOrphanMedia() {
  return (await httpClient.get('/content/media/orphans')).data;
}
export async function deleteOrphanMedia(ids) {
  return (await httpClient.delete('/content/media/orphans', { data: { ids } })).data;
}
