/** Bounded DOM fit, run only on content/size/assets events. Never changes data or media. */
export function fitChoiceContent(root: HTMLElement) {
  const { width, height } = root.getBoundingClientRect();
  if (width <= 0 || height <= 0) return;
  const hasMedia = root.dataset.choiceMedia === "true";
  const layouts = hasMedia ? ["side-grid", "side-list"] : ["top-grid", "side-list", "side-grid", "top-list"];
  const maxAnswer = Math.min(144, width * .075, height * .23);
  const maxQuestion = Math.min(64, width * .052, height * .2);
  const write = (answer: number, layout: string) => {
    root.dataset.choiceLayout = layout;
    root.style.setProperty("--pres-answer", `${answer}px`);
    root.style.setProperty("--choice-question-size", `${Math.min(maxQuestion, hasMedia ? answer * .8 + 8 : answer * .85 + 12)}px`);
    root.style.setProperty("--pres-info", `${Math.max(14, answer * .52)}px`);
    root.style.setProperty("--choice-gap", `${Math.max(6, Math.min(18, answer * .22))}px`);
    root.style.setProperty("--choice-padding", `${Math.max(6, Math.min(22, answer * .25))}px`);
  };
  const fits = () => {
    const bounds = root.getBoundingClientRect();
    if (root.scrollHeight > root.clientHeight + 1 || root.scrollWidth > root.clientWidth + 1) return false;
    const elements = root.querySelectorAll<HTMLElement>(".presentation-choice-lead,.presentation-choice-options,.presentation-classical-option,h2,p,.presentation-choice-answer,.presentation-choice-media");
    for (const e of elements) {
      const r = e.getBoundingClientRect();
      if (r.left < bounds.left - 1 || r.right > bounds.right + 1 || r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1 || e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) return false;
    }
    return true;
  };
  let best = { size: 0, layout: layouts[0] };
  for (const layout of layouts) {
    let low = 18, high = maxAnswer;
    write(low, layout);
    if (!fits()) continue;
    for (let i = 0; i < 9; i++) {
      const mid = (low + high) / 2;
      write(mid, layout);
      if (fits()) low = mid; else high = mid;
    }
    if (low > best.size + .5) best = { size: low, layout };
  }
  write(best.size ? Math.max(18, best.size - .5) : 18, best.layout);
  root.dataset.choiceFit = best.size && fits() ? "fitted" : "unreadable";
}



