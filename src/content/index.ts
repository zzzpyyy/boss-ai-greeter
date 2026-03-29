function getText(el: Element | null | undefined) {
  return el?.textContent?.trim() || "";
}

function pickFirstText(selectors: string[], root: ParentNode = document) {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    const text = getText(el);
    if (text) return text;
  }
  return "";
}

function isVisible(element: Element) {
  const htmlElement = element as HTMLElement;
  const rect = htmlElement.getBoundingClientRect();
  const style = window.getComputedStyle(htmlElement);

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function getClickableElements(selectors: string[]) {
  const elements = selectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector))
  );

  return elements.filter((element, index, list) => {
    if (!(element instanceof HTMLElement)) return false;
    if (!isVisible(element)) return false;
    return list.indexOf(element) === index;
  }) as HTMLElement[];
}

function getButtonHints(element: HTMLElement) {
  return `${element.textContent || ""} ${getElementHints(element)} ${getContextHints(element)}`.toLowerCase();
}

function findBestButton(keywords: string[]) {
  const buttons = getClickableElements([
    "button",
    "[role='button']",
    ".btn",
    "[class*=button]",
    "[class*=btn]"
  ]);

  return buttons
    .map((element) => {
      const hints = getButtonHints(element);
      let score = 0;

      for (const keyword of keywords) {
        if (hints.includes(keyword)) score += 3;
      }

      if (hints.includes("立即")) score += 2;
      if (hints.includes("继续")) score += 2;
      if (hints.includes("沟通")) score += 2;
      if (hints.includes("chat")) score += 1;
      if (hints.includes("message")) score += 1;

      return { element, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.element || null;
}

function clickElement(element: HTMLElement) {
  element.scrollIntoView({ block: "center", inline: "center" });
  element.focus();
  element.click();
}

async function waitForVisibleButton(keywords: string[], timeout = 5000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const button = findBestButton(keywords);
    if (button) return button;
    await new Promise((resolve) => window.setTimeout(resolve, 200));
  }

  return null;
}

async function openCommunicationFlow() {
  if (isOnCommunicationPage()) {
    return { ok: true };
  }

  const immediateButton = findBestButton(["立即沟通", "立即", "沟通", "chat", "message"]);
  if (!immediateButton) {
    return {
      ok: false,
      error: "未找到“立即沟通”按钮"
    };
  }

  clickElement(immediateButton);

  const continueButton = await waitForVisibleButton(["继续沟通", "继续", "沟通", "chat", "message"], 5000);
  if (!continueButton) {
    return {
      ok: false,
      error: "未找到“继续沟通”按钮"
    };
  }

  clickElement(continueButton);

  const start = Date.now();
  while (Date.now() - start < 8000) {
    if (isOnCommunicationPage()) {
      return { ok: true };
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  return {
    ok: false,
    error: "点击“继续沟通”后仍未进入沟通页面"
  };
}

function getVisibleElements(selectors: string[]) {
  const elements = selectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector))
  );

  return elements.filter((element, index, list) => {
    if (!(element instanceof HTMLElement)) return false;
    if (!isVisible(element)) return false;
    return list.indexOf(element) === index;
  }) as HTMLElement[];
}

function getDetailRootScore(root: HTMLElement) {
  const title = pickFirstText([
    ".job-name",
    ".name",
    "[class*=job-title]"
  ], root);

  const description = pickFirstText([
    ".job-sec-text",
    "[class*=job-detail]",
    "[class*=description]"
  ], root);

  const company = pickFirstText([
    ".company-name",
    "[class*=company-name]",
    "[class*=company]"
  ], root);

  let score = 0;
  if (title) score += 3;
  if (description) score += 3;
  if (company) score += 2;

  const classHints = `${root.className} ${root.id}`.toLowerCase();
  if (classHints.includes("detail")) score += 2;
  if (classHints.includes("job")) score += 1;

  return score;
}

function getPreferredDetailRoot() {
  const candidates = getVisibleElements([
    ".job-detail",
    ".job-card-body",
    ".job-sec",
    ".job-info",
    "[class*=job-detail]",
    "[class*=detail-container]",
    "[class*=job-card]",
    "main",
    "body"
  ]);

  return candidates
    .map((element) => ({ element, score: getDetailRootScore(element) }))
    .sort((a, b) => b.score - a.score)[0]?.element || document.body;
}

function extractJobDetailRawText() {
  const root = getPreferredDetailRoot();

  const title = pickFirstText([
    ".job-name",
    ".name",
    "[class*=job-title]"
  ], root);

  const salary = pickFirstText([
    ".salary",
    "[class*=salary]"
  ], root);

  const company = pickFirstText([
    ".company-name",
    "[class*=company-name]",
    "[class*=company]"
  ], root);

  const description = pickFirstText([
    ".job-sec-text",
    "[class*=job-detail]",
    "[class*=description]"
  ], root);

  const tags = Array.from(root.querySelectorAll(".tag-list li, .labels-tag"))
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

  if (!title && !description) {
    throw new Error("未找到当前可见岗位详情");
  }

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

function getElementHints(element: HTMLElement) {
  return [
    element.getAttribute("placeholder") || "",
    element.getAttribute("aria-label") || "",
    element.getAttribute("role") || "",
    element.getAttribute("class") || "",
    element.getAttribute("id") || "",
    element.getAttribute("name") || ""
  ].join(" ").toLowerCase();
}

function getAncestorChain(element: HTMLElement) {
  const nodes: HTMLElement[] = [];
  let current: HTMLElement | null = element;

  while (current && nodes.length < 6) {
    nodes.push(current);
    current = current.parentElement;
  }

  return nodes;
}

function getContextHints(element: HTMLElement) {
  return getAncestorChain(element)
    .map((node) => `${node.className} ${node.id} ${node.getAttribute("role") || ""}`)
    .join(" ")
    .toLowerCase();
}

function isLikelySearchBox(element: HTMLElement) {
  const hints = `${getElementHints(element)} ${getContextHints(element)}`;
  return hints.includes("搜索") || hints.includes("search");
}

function isLikelyDialogInput(element: HTMLElement) {
  const hints = `${getElementHints(element)} ${getContextHints(element)}`;
  return hints.includes("dialog") || hints.includes("modal") || hints.includes("弹窗");
}

function isLikelyChatInput(element: HTMLElement) {
  const hints = `${getElementHints(element)} ${getContextHints(element)}`;

  return ["chat", "message", "msg", "im", "沟通", "聊天", "对话", "发送"]
    .some((keyword) => hints.includes(keyword));
}

function isOnCommunicationPage() {
  const pageHints = `${location.href} ${document.body.className} ${document.body.id}`.toLowerCase();
  if (["chat", "geek", "message", "im"].some((keyword) => pageHints.includes(keyword))) {
    return true;
  }

  const visibleChatContainers = getVisibleElements([
    "[class*=chat]",
    "[class*=message]",
    "[class*=im]",
    "[class*=dialogue]",
    "[class*=conversation]",
    "[role='log']"
  ]);

  return visibleChatContainers.length > 0;
}

function getCandidatePriority(element: HTMLElement) {
  if (isLikelyChatInput(element) && element.isContentEditable) return 10;
  if (isLikelyChatInput(element) && element.getAttribute("role") === "textbox") return 9;
  if (isLikelyChatInput(element) && element instanceof HTMLTextAreaElement) return 8;
  if (isLikelyChatInput(element)) return 7;
  if (element.isContentEditable) return 4;
  if (element.getAttribute("role") === "textbox") return 3;
  if (element instanceof HTMLTextAreaElement) return 2;
  if (element instanceof HTMLInputElement && ["text", "search", ""].includes(element.type)) return 1;
  return 0;
}

function getChatContainerScore(element: HTMLElement) {
  const hints = `${getElementHints(element)} ${getContextHints(element)}`;
  let score = 0;

  if (["chat", "message", "im", "dialogue", "conversation", "沟通", "聊天", "消息"]
    .some((keyword) => hints.includes(keyword))) {
    score += 4;
  }

  if (["input", "editor", "composer", "textbox", "footer", "send", "reply", "编辑", "输入", "发送"]
    .some((keyword) => hints.includes(keyword))) {
    score += 3;
  }

  const editables = getEditableElements(element);
  if (editables.length > 0) score += 4;
  if (editables.some((editable) => isLikelyChatInput(editable))) score += 4;

  return score;
}

function getEditableElements(root: ParentNode) {
  const selectors = [
    "textarea",
    "input",
    "[role='textbox']",
    "[contenteditable='true']",
    "[contenteditable='plaintext-only']",
    "[contenteditable]:not([contenteditable='false'])",
    "[class*=editor]",
    "[class*=input]",
    "[class*=composer]",
    "[class*=textbox]",
    "[data-placeholder]"
  ];

  return selectors.flatMap((selector) =>
    Array.from(root.querySelectorAll(selector))
  ).filter((element, index, list) => {
    if (!(element instanceof HTMLElement)) return false;
    if (!isVisible(element)) return false;
    if (isLikelySearchBox(element)) return false;
    if (isLikelyDialogInput(element)) return false;

    const isEditable =
      element.isContentEditable ||
      element.getAttribute("role") === "textbox" ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLInputElement ||
      element.hasAttribute("data-placeholder") ||
      /editor|input|composer|textbox/i.test(element.className);

    if (!isEditable) return false;
    return list.indexOf(element) === index;
  }) as HTMLElement[];
}

function getPreferredChatScope() {
  const nearbyChatContainer = getNearbyChatContainer();
  if (nearbyChatContainer) return nearbyChatContainer;

  const candidates = getVisibleElements([
    "[class*=chat]",
    "[class*=message]",
    "[class*=im]",
    "[class*=dialogue]",
    "[class*=conversation]",
    "[class*=editor]",
    "[class*=input]",
    "[class*=composer]",
    "[class*=footer]",
    "footer",
    "main",
    "body"
  ]);

  return candidates
    .map((element) => ({ element, score: getChatContainerScore(element) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.element || document;
}

function getNearbyChatContainer() {
  const sendButtonLike = Array.from(document.querySelectorAll("button, [role='button'], .btn, [class*=button]"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .find((element) => {
      if (!isVisible(element)) return false;
      const text = `${element.textContent || ""} ${getElementHints(element)} ${getContextHints(element)}`.toLowerCase();
      return ["发送", "send", "沟通", "聊天", "message"].some((keyword) => text.includes(keyword));
    });

  if (!sendButtonLike) return null;

  return getAncestorChain(sendButtonLike).find((node) => {
    const inputs = getEditableElements(node);
    return inputs.length > 0;
  }) || null;
}

function getFillCandidates() {
  const source = getPreferredChatScope();
  const elements = getEditableElements(source);

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    elements.unshift(activeElement);
  }

  return elements
    .filter((element, index, list) => {
      if (!(element instanceof HTMLElement)) return false;
      if (!isVisible(element)) return false;
      if (isLikelySearchBox(element)) return false;
      if (isLikelyDialogInput(element)) return false;
      return list.indexOf(element) === index;
    })
    .sort((a, b) => getCandidatePriority(b as HTMLElement) - getCandidatePriority(a as HTMLElement));
}

function fillElement(element: HTMLElement, greeting: string) {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    element.focus();
    setNativeValue(element, greeting);
    return true;
  }

  if (element.isContentEditable) {
    element.focus();
    element.textContent = greeting;
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: greeting
    }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  return false;
}

function fillGreetingInput(greeting: string) {
  if (!isOnCommunicationPage()) {
    return {
      ok: false,
      error: "请先点击“立即沟通”，并进入真正的沟通页面后再填入"
    };
  }

  const preferredScope = getPreferredChatScope();
  const candidates = getFillCandidates();
  const chatCandidates = candidates.filter((candidate) => isLikelyChatInput(candidate as HTMLElement));
  const finalCandidates = chatCandidates.length > 0 ? chatCandidates : candidates;

  for (const candidate of finalCandidates) {
    if (!(candidate instanceof HTMLElement)) continue;
    if (fillElement(candidate, greeting)) {
      return {
        ok: true
      };
    }
  }

  const scopeHints = preferredScope instanceof HTMLElement
    ? `${preferredScope.className} ${preferredScope.id}`.trim() || preferredScope.tagName.toLowerCase()
    : "document";

  return {
    ok: false,
    error: `未找到可输入的沟通框，已尝试 ${finalCandidates.length} 个候选元素，当前作用域：${scopeHints}`
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "OPEN_COMMUNICATION") {
    void openCommunicationFlow()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
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
      const result = fillGreetingInput(message.greeting);
      sendResponse(result);
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
    return true;
  }
});
