const assert = (ok, message) => { if (!ok) throw new Error(message); };

export async function gradeAll({ page, origin, quizId, expectedRows, onProgress }) {
  await page.goto(`${origin}/quiz/${quizId}/auswertung`);
  for (let batch = 0; batch < 20; batch++) {
    const resume = page.getByRole('button', { name: 'Berechnung fortsetzen', exact: true });
    if (!await resume.count()) break;
    await resume.click();
    await page.getByRole('button', { name: 'Berechnung läuft …', exact: true }).waitFor({ state: 'hidden' });
    await page.waitForTimeout(300);
  }
  const rows = page.locator('tbody tr');
  assert(await rows.count() === expectedRows, 'Unexpected evaluation row count');
  const result = { quizId, expectedRows, times: [], checked: 0 };
  for (let index = 0; index < expectedRows; index++) {
    const row = rows.nth(index);
    assert((await row.innerText()).includes('Automatisch finalisierte Abgabe'), 'Missing final submission');
    const start = performance.now();
    await row.getByRole('textbox', { name: 'Manuelle Punkte' }).fill('0.5');
    await row.getByRole('button', { name: 'Teilweise', exact: true }).click();
    await page.waitForFunction(i => document.querySelectorAll('tbody tr')[i]?.innerText.includes('Vergeben: 0,5'), index);
    result.times.push(performance.now() - start);
    result.checked++;
    onProgress?.(result.checked, result);
  }
  await page.reload();
  result.halfPointRows = await rows.evaluateAll(elements => elements.filter(e => e.innerText.includes('Vergeben: 0,5')).length);
  assert(result.halfPointRows === expectedRows, 'Partial points did not persist');
  const first = rows.first();
  result.changedTeam = await first.locator('td').first().innerText();
  await first.getByRole('button', { name: 'Richtig', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('tbody tr')?.innerText.includes('Vergeben: 1'));
  await page.getByRole('button', { name: 'Punktestand', exact: true }).click();
  result.scoreRows = await page.locator('tbody tr').allInnerTexts();
  return result;
}

export async function gradePixel({ page, origin, quizId, teams, onProgress }) {
  await page.goto(`${origin}/quiz/${quizId}/auswertung`);
  for (let n = 0; n < 20; n++) {
    const resume = page.getByRole('button', { name: 'Berechnung fortsetzen', exact: true });
    if (!await resume.count()) break;
    await resume.click();
    await page.getByRole('button', { name: 'Berechnung läuft …', exact: true }).waitFor({ state: 'hidden' });
    await page.waitForTimeout(300);
  }
  const rows = page.locator('tbody tr').filter({ hasText: 'Codex AP3 Stufenwertung' });
  assert(await rows.count() === teams.length, 'Pixel evaluation row count wrong');
  const result = { times: [], points: [] };
  for (let i = 0; i < teams.length; i++) {
    const row = rows.filter({ has: page.getByText(teams[i].input.teamname, { exact: true }) });
    const start = performance.now();
    await row.getByRole('button', { name: 'Richtig', exact: true }).click();
    const expected = i < 13 ? 3 : i < 26 ? 2 : 1;
    await page.waitForFunction(({ name, expected }) => Array.from(document.querySelectorAll('tbody tr')).some(r => r.innerText.includes(name) && r.innerText.includes(`Vergeben: ${expected}`)), { name: teams[i].input.teamname, expected });
    result.times.push(performance.now() - start);
    result.points.push({ team: i, expected }); onProgress?.(i + 1);
  }
  await page.reload();
  for (const point of result.points) {
    const text = await rows.filter({ has: page.getByText(teams[point.team].input.teamname, { exact: true }) }).innerText();
    assert(text.includes(`Vergeben: ${point.expected}`), 'Pixel points changed on reload');
  }
  await page.getByRole('button', { name: 'Punktestand', exact: true }).click();
  result.ranking = await page.locator('tbody tr').allInnerTexts();
  return result;
}

export async function verifyFinalContent({ page, teams, questions }) {
  // innerText collapses repeated spaces in choice labels; textContent retains
  // the actual persisted/displayed string before CSS whitespace layout.
  const rows = await page.locator('tbody tr').evaluateAll(elements => elements.map(e => Array.from(e.querySelectorAll('td')).map((c, i) => i === 3 ? c.textContent : c.innerText)));
  const result = { checked: 0, mismatches: [], pointTotals: {} };
  for (const cells of rows) {
    const team = teams.find(t => t.input.teamname === cells[0]);
    if (!team) continue;
    const index = Number(cells[1].match(/FRAGE (\d+)/i)?.[1]) - 1;
    const question = questions[index];
    assert(question, 'Evaluation question not in fixture');
    const value = team.confirmed.get(question.quiz_fragen_id);
    assert(value, 'Expected confirmed answer absent');
    let expected = value.answerText;
    if (question.interaction.options) expected = question.interaction.options.filter(o => value.selectedAnswerIds.includes(o.id)).map(o => o.label).join(' · ');
    if (question.interaction.type === 'ORDER') expected = JSON.parse(value.answerText).map(id => question.interaction.items.find(x => x.id === id).text).join(' → ');
    const actual = cells[3].replace(/\n?Automatisch finalisierte Abgabe$/, '').trim();
    result.checked++;
    if (actual !== expected || !cells[3].includes('Automatisch finalisierte Abgabe')) result.mismatches.push({ team: team.index, question: index, expected, actual });
    const points = Number(cells[4].match(/Vergeben: ([\d,.]+)/)?.[1].replace(',', '.') ?? '0');
    result.pointTotals[cells[0]] = (result.pointTotals[cells[0]] ?? 0) + points;
  }
  assert(result.checked === teams.length * questions.length, 'Missing or duplicate final submissions');
  assert(!result.mismatches.length, 'Final submission content differs from confirmed save');
  return result;
}
