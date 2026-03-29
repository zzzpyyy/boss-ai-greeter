import { useEffect, useMemo, useState } from "react";
import { createGreeting, extractJD, extractResume } from "../shared/ai";
import { extractTextFromPdf } from "../shared/pdf";
import { extractTextFromDocx } from "../shared/docx";
import { getAIConfig, getJDStructured, getResumeStructured, getResumeText, saveAIConfig, saveJDStructured, saveResumeStructured, saveResumeText } from "../shared/storage";
import type { AIConfig, JDStructured, ResumeStructured } from "../shared/types";

async function getCurrentTabId(): Promise<number> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) throw new Error("未找到当前标签页");
  return tab.id;
}

async function ensureContentScriptReady(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return;
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getResumeFileType(file: File) {
  const lowerName = file.name.toLowerCase();

  if (
    file.type === "application/pdf" ||
    lowerName.endsWith(".pdf")
  ) {
    return "pdf";
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return "docx";
  }

  return null;
}

function maskApiKey(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";

  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
}

export default function App() {
  const [config, setConfig] = useState<AIConfig>({
    baseURL: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini"
  });
  const [savedConfig, setSavedConfig] = useState<AIConfig>({
    baseURL: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini"
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [resume, setResume] = useState<ResumeStructured | null>(null);
  const [jd, setJD] = useState<JDStructured | null>(null);
  const [greeting, setGreeting] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await getAIConfig();
      const savedResumeText = await getResumeText();
      const savedResume = await getResumeStructured();
      const savedJD = await getJDStructured();
      setConfig(saved);
      setSavedConfig(saved);
      setResumeText(savedResumeText);
      setResume(savedResume);
      setJD(savedJD);
    })();
  }, []);

  const isApiKeySaved = !!savedConfig.apiKey.trim();
  const isApiKeyDirty = config.apiKey !== savedConfig.apiKey;
  const maskedSavedApiKey = useMemo(
    () => maskApiKey(savedConfig.apiKey),
    [savedConfig.apiKey]
  );

  const apiKeyStatus = useMemo(() => {
    if (!config.apiKey.trim() && !savedConfig.apiKey.trim()) {
      return {
        text: "未配置",
        className: "status-badge empty"
      };
    }

    if (isApiKeyDirty) {
      return {
        text: config.apiKey.trim() ? "已修改未保存" : "待清空未保存",
        className: "status-badge pending"
      };
    }

    return {
      text: "已配置（已保存）",
      className: "status-badge saved"
    };
  }, [config.apiKey, savedConfig.apiKey, isApiKeyDirty]);

  async function handleSaveConfig() {
    await saveAIConfig(config);
    setSavedConfig(config);
    setMessage("AI 配置已保存");
  }

  function handleAskClearApiKey() {
    if (!config.apiKey && !savedConfig.apiKey) {
      setMessage("当前没有可清空的 API Key");
      return;
    }
    setShowClearConfirm(true);
  }

  async function handleConfirmClearApiKey() {
    const nextConfig = {
      ...config,
      apiKey: ""
    };
    setConfig(nextConfig);
    await saveAIConfig(nextConfig);
    setSavedConfig(nextConfig);
    setShowApiKey(false);
    setShowClearConfirm(false);
    setMessage("API Key 已清空");
  }

  function handleCancelClearApiKey() {
    setShowClearConfirm(false);
  }

  async function handleSaveResumeText() {
    setResume(null);
    setGreeting("");
    await saveResumeStructured(null);
    await saveResumeText(resumeText);
    setMessage("简历文本已保存");
  }

  async function handleUploadResumeFile(file: File) {
    if (!file) return;

    const fileType = getResumeFileType(file);
    if (!fileType) {
      setMessage("仅支持 PDF 或 DOCX 文件");
      return;
    }

    setLoading(true);
    setMessage(fileType === "pdf" ? "正在解析 PDF..." : "正在解析 DOCX...");

    try {
      const text = fileType === "pdf"
        ? await extractTextFromPdf(file)
        : await extractTextFromDocx(file);

      if (!text.trim()) {
        throw new Error(fileType === "pdf"
          ? "未能从 PDF 中提取到文本，可能是扫描版 PDF"
          : "未能从 DOCX 中提取到文本");
      }

      setResumeText(text);
      setResume(null);
      setGreeting("");
      await saveResumeText(text);
      await saveResumeStructured(null);
      setMessage(fileType === "pdf" ? "PDF 解析完成，已填入简历文本" : "DOCX 解析完成，已填入简历文本");
    } catch (error) {
      setMessage(`${fileType.toUpperCase()} 解析失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleExtractResume() {
    if (!resumeText.trim()) {
      setMessage("请先输入简历文本或上传 PDF / DOCX");
      return;
    }
    if (!config.apiKey.trim()) {
      setMessage("请先配置 API Key");
      return;
    }

    setLoading(true);
    setMessage("正在提取简历亮点...");
    try {
      const result = await extractResume(config, resumeText);
      setResume(result);
      await saveResumeStructured(result);
      setMessage("简历提取完成");
    } catch (error) {
      setMessage(`简历提取失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleExtractJD() {
    if (!config.apiKey.trim()) {
      setMessage("请先配置 API Key");
      return;
    }

    setLoading(true);
    setMessage("正在抓取并解析 JD...");
    try {
      const tabId = await getCurrentTabId();
      await ensureContentScriptReady(tabId);
      const response = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_JD" });

      if (!response?.ok || !response.rawText) {
        throw new Error(response?.error || "抓取 JD 失败");
      }

      const result = await extractJD(config, response.rawText);
      setJD(result);
      await saveJDStructured(result);
      setMessage("JD 解析完成");
    } catch (error) {
      setMessage(`JD 处理失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateGreeting() {
    if (!config.apiKey.trim()) {
      setMessage("请先配置 API Key");
      return;
    }
    if (!resume || !jd) {
      setMessage("请先完成简历提取和 JD 提取");
      return;
    }

    setLoading(true);
    setMessage("正在生成招呼语...");
    try {
      const text = await createGreeting(config, resume, jd);
      setGreeting(text);
      setMessage("招呼语已生成");
    } catch (error) {
      setMessage(`生成失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleFillGreeting() {
    if (!greeting.trim()) {
      setMessage("请先生成招呼语");
      return;
    }

    try {
      const tabId = await getCurrentTabId();
      await ensureContentScriptReady(tabId);

      setMessage("正在打开沟通页面...");
      const openResponse = await chrome.tabs.sendMessage(tabId, {
        type: "OPEN_COMMUNICATION"
      });

      if (!openResponse?.ok) {
        throw new Error(openResponse?.error || "无法进入沟通页面");
      }

      let lastError = "填入失败";

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await sleep(attempt === 0 ? 1200 : 600);
        await ensureContentScriptReady(tabId);

        setMessage("正在填入沟通输入框...");
        const response = await chrome.tabs.sendMessage(tabId, {
          type: "FILL_GREETING",
          greeting
        });

        if (response?.ok) {
          setMessage("已自动进入沟通页并填入输入框，请手动确认发送");
          return;
        }

        lastError = response?.error || lastError;
      }

      throw new Error(lastError);
    } catch (error) {
      setMessage(`填入失败: ${String(error)}`);
    }
  }

  async function handleCopyGreeting() {
    if (!greeting.trim()) return;
    await navigator.clipboard.writeText(greeting);
    setMessage("已复制招呼语");
  }

  return (
    <div className="container">
      <h1>Boss AI Greeter</h1>

      <section className="card">
        <h2>AI 配置</h2>

        <div className="config-status-row">
          <span className="config-status-label">API Key 状态</span>
          <span className={apiKeyStatus.className}>{apiKeyStatus.text}</span>
        </div>

        {isApiKeySaved && !isApiKeyDirty && (
          <div className="block">
            <div>
              <strong>已保存 Key：</strong>
              {maskedSavedApiKey}
            </div>
          </div>
        )}

        {isApiKeySaved && isApiKeyDirty && (
          <div className="block">
            <div>
              <strong>当前已保存 Key：</strong>
              {maskedSavedApiKey}
            </div>
          </div>
        )}

        <input
          className="input"
          placeholder="Base URL，例如 https://api.openai.com/v1"
          value={config.baseURL}
          onChange={(e) => setConfig({ ...config, baseURL: e.target.value })}
        />

        <div className="api-key-row">
          <input
            className="input api-key-input"
            placeholder="API Key"
            type={showApiKey ? "text" : "password"}
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          />
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setShowApiKey((v) => !v)}
          >
            {showApiKey ? "隐藏" : "显示"}
          </button>
          <button
            type="button"
            className="danger-btn"
            onClick={handleAskClearApiKey}
            disabled={!config.apiKey && !isApiKeySaved}
          >
            清空
          </button>
        </div>

        <input
          className="input"
          placeholder="模型名，例如 gpt-4o-mini"
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
        />

        <button onClick={handleSaveConfig}>保存配置</button>
      </section>

      <section className="card">
        <h2>1. 简历文本</h2>
        <input
          className="input"
          type="file"
          accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void handleUploadResumeFile(file);
            }
            e.currentTarget.value = "";
          }}
        />
        <textarea
          className="text-box"
          placeholder="把简历内容粘贴到这里，或者上传 PDF / DOCX"
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
        />
        <div className="actions">
          <button onClick={handleSaveResumeText}>保存简历文本</button>
          <button disabled={loading} onClick={handleExtractResume}>提取简历亮点</button>
        </div>

        {resume && (
          <div className="block">
            <div><strong>目标岗位：</strong>{resume.targetRole || "-"}</div>
            <div><strong>技能：</strong>{resume.skills.join("、") || "-"}</div>
            <div><strong>亮点：</strong></div>
            <ul>
              {resume.highlights.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <h2>2. 当前 JD</h2>
        <button disabled={loading} onClick={handleExtractJD}>抓取并解析 JD</button>

        {jd && (
          <div className="block">
            <div><strong>岗位：</strong>{jd.title || "-"}</div>
            <div><strong>公司：</strong>{jd.company || "-"}</div>
            <div><strong>总结：</strong>{jd.summary}</div>
            <div><strong>关键词：</strong>{jd.keywords.join("、")}</div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>3. 招呼语</h2>
        <button disabled={loading} onClick={handleGenerateGreeting}>生成招呼语</button>

        <textarea
          className="text-box small"
          placeholder="这里显示 AI 生成的打招呼内容"
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
        />

        <div className="actions">
          <button disabled={!greeting} onClick={handleCopyGreeting}>复制</button>
        </div>
      </section>

      <div className="status">{loading ? "处理中..." : message}</div>

      {showClearConfirm && (
        <div className="modal-mask">
          <div className="modal">
            <div className="modal-title">确认清空 API Key？</div>
            <div className="modal-text">
              清空后将无法继续调用 AI，且本地已保存的 Key 也会被删除。
            </div>
            <div className="modal-actions">
              <button className="secondary-btn" onClick={handleCancelClearApiKey}>
                取消
              </button>
              <button className="danger-btn" onClick={handleConfirmClearApiKey}>
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
