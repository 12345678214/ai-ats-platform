const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// Thin client for the Python AI service. Every call carries the shared service key.
const http = axios.create({
  baseURL: env.AI_SERVICE_URL,
  timeout: 45_000,
  headers: { 'X-Service-Key': env.AI_SERVICE_KEY },
});

function wrap(err, action) {
  if (err.response) {
    const msg = err.response.data?.error || err.response.data?.message || `status ${err.response.status}`;
    return new Error(`AI service could not ${action}: ${msg}`);
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND') {
    return new Error(`AI service is unreachable at ${env.AI_SERVICE_URL}`);
  }
  return err;
}

async function parseResume(filePath, originalName) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), { filename: originalName });
  try {
    const { data } = await http.post('/parse-resume', form, { headers: form.getHeaders(), maxBodyLength: Infinity });
    return data;
  } catch (err) {
    throw wrap(err, 'parse the resume');
  }
}

async function extractJobSkills({ title, description, requirements }) {
  try {
    const { data } = await http.post('/extract-job-skills', { title, description, requirements });
    return data; // { skills: [{ name, category, required }], minExperience }
  } catch (err) {
    throw wrap(err, 'extract job skills');
  }
}

async function match(payload) {
  try {
    const { data } = await http.post('/match', payload);
    return data;
  } catch (err) {
    throw wrap(err, 'score this candidate');
  }
}

async function rank(payload) {
  try {
    const { data } = await http.post('/rank', payload);
    return data;
  } catch (err) {
    throw wrap(err, 'rank candidates');
  }
}

async function health() {
  try {
    const { data } = await http.get('/health', { timeout: 3000 });
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: wrap(err, 'respond').message };
  }
}

function assertAvailable(result) {
  if (!result.ok) throw new ApiError(503, result.error);
}

module.exports = { parseResume, extractJobSkills, match, rank, health, assertAvailable };
