import type { AIConfig, JDStructured, ResumeStructured } from "./types";
import {
  GREETING_PROMPT,
  JD_EXTRACT_PROMPT,
  RESUME_EXTRACT_PROMPT
} from "./prompts";

async function chatJSON<T>(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const resp = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI 请求失败: ${text}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}

async function chatText(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const resp = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI 请求失败: ${text}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export async function extractResume(
  config: AIConfig,
  rawText: string
): Promise<ResumeStructured> {
  const result = await chatJSON<ResumeStructured>(
    config,
    RESUME_EXTRACT_PROMPT,
    `简历原文如下：\n${rawText}`
  );
  return { ...result, rawText };
}

export async function extractJD(
  config: AIConfig,
  rawText: string
): Promise<JDStructured> {
  const result = await chatJSON<JDStructured>(
    config,
    JD_EXTRACT_PROMPT,
    `JD 原文如下：\n${rawText}`
  );
  return { ...result, rawText };
}

export async function createGreeting(
  config: AIConfig,
  resume: ResumeStructured,
  jd: JDStructured
): Promise<string> {
  const userPrompt = `
候选人信息：
- 目标岗位：${resume.targetRole || ""}
- 技能：${resume.skills.join("、")}
- 简历亮点：${resume.highlights.join("；")}
- 项目经验：${resume.projects.map((item) => `${item.name}：${item.summary}`).join("；")}

岗位信息：
- 岗位名称：${jd.title || ""}
- 公司：${jd.company || ""}
- 岗位总结：${jd.summary}
- 岗位要求：${jd.requirements.join("；")}
- 关键词：${jd.keywords.join("、")}

请先识别岗位最核心的诉求，再从候选人经历里挑出最能对应的亮点，写成一句更有针对性、更有辨识度的开场白。
`;

  return chatText(config, GREETING_PROMPT, userPrompt);
}
