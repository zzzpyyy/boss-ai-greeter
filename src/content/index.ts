function getText(el: Element | null | undefined) {
  return el?.textContent?.trim() || "";
}

function pickFirstText(selectors: string[]) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const text = getText(el);
    if (text) return text;
  }
  return "";
}

function extractJobDetailRawText() {
  const title = pickFirstText([
    ".job-name",
    ".name",
    "[class*=job-title]"
  ]);

  const salary = pickFirstText([
    ".salary",
    "[class*=salary]"
  ]);

  const company = pickFirstText([
    ".company-name",
    "[class*=company-name]",
    "[class*=company]"
  ]);

  const description = pickFirstText([
    ".job-sec-text",
    "[class*=job-detail]",
    "[class*=description]"
  ]);

  const tags = Array.from(document.querySelectorAll(".tag-list li, .labels-tag"))
    .map((el) => getText(el))
    .filter(Boolean)
    .join(" / ");

  const rawText = `
职位名称：${title}
公司名称：${company}
薪资：${salary}
标签：${tags}
职位描述：${description}
`.trim();

  return rawText;
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillGreetingInput(greeting: string) {
  const input = document.querySelector("textarea, div[contenteditable='true']");
  if (!input) return false;

  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    setNativeValue(input, greeting);
    return true;
  }

  if (input instanceof HTMLDivElement && input.isContentEditable) {
    input.focus();
    input.innerText = greeting;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  return false;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "EXTRACT_JD") {
    try {
      const rawText = extractJobDetailRawText();
      sendResponse({ ok: true, rawText });
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
    return true;
  }

  if (message.type === "FILL_GREETING") {
    try {
      const ok = fillGreetingInput(message.greeting);
      sendResponse({ ok });
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
    return true;
  }
});
