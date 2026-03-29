import type { AIConfig, JDStructured, ResumeStructured } from "./types";

const AI_CONFIG_KEY = "ai_config";
const RESUME_TEXT_KEY = "resume_text";
const RESUME_STRUCTURED_KEY = "resume_structured";
const JD_STRUCTURED_KEY = "jd_structured";

export async function saveAIConfig(config: AIConfig) {
  await chrome.storage.local.set({
    [AI_CONFIG_KEY]: config
  });
}

export async function getAIConfig(): Promise<AIConfig> {
  const result = await chrome.storage.local.get(AI_CONFIG_KEY);
  return result[AI_CONFIG_KEY] || {
    baseURL: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini"
  };
}

export async function saveResumeText(text: string) {
  await chrome.storage.local.set({
    [RESUME_TEXT_KEY]: text
  });
}

export async function getResumeText(): Promise<string> {
  const result = await chrome.storage.local.get(RESUME_TEXT_KEY);
  return result[RESUME_TEXT_KEY] || "";
}

export async function saveResumeStructured(resume: ResumeStructured | null) {
  await chrome.storage.local.set({
    [RESUME_STRUCTURED_KEY]: resume
  });
}

export async function getResumeStructured(): Promise<ResumeStructured | null> {
  const result = await chrome.storage.local.get(RESUME_STRUCTURED_KEY);
  return result[RESUME_STRUCTURED_KEY] || null;
}

export async function saveJDStructured(jd: JDStructured | null) {
  await chrome.storage.local.set({
    [JD_STRUCTURED_KEY]: jd
  });
}

export async function getJDStructured(): Promise<JDStructured | null> {
  const result = await chrome.storage.local.get(JD_STRUCTURED_KEY);
  return result[JD_STRUCTURED_KEY] || null;
}
