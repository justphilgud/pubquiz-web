import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { loadQuestionForEditor } from "@/app/fragen/editor/questionEditorData";
import { pairColumns } from "@/app/fragen/editor/templates/pairsTemplate";
import { issueTeamSessionToken } from "@/app/quiz/teamSessionToken";
import { fixtureEmail, fixturePassword, fixtureSecret, fixtureWorkbook, openExcelFixture, testDatabase } from "./excelImportFixture";

type Reply = {
  targetId?: string;
  sessionId?: string;
  result?: { value?: unknown; description?: string };
  exceptionDetails?: unknown;
};

async function eventually<T>(read: () => T | Promise<T>, description: string): Promise<NonNullable<T>> {
  for (let i = 0; i < 250; i++) {
    const value = await read();
    if (value) return value as NonNullable<T>;
    await delay(120);
  }
  throw new Error(`Zeitlimit: ${description}`);
}

test("real Next.js and Chromium: XLSX download, preview, import, editor and quiz surfaces", {
  skip: !testDatabase || process.env.EXCEL_IMPORT_BROWSER !== "1", timeout: 240_000,
}, async () => {
  const chrome = [process.env.CHROME_BIN, "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium"].find(path => path && existsSync(path));
  assert.ok(chrome, "Chromium/Chrome required");
  const fixture = await openExcelFixture();
  const { db } = fixture;
  const profile = mkdtempSync(join(tmpdir(), "pubquiz-excel-browser-"));
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "0"], {
    env: { ...process.env, DATABASE_URL: fixture.url, AUTH_SECRET: fixtureSecret, AUTH_TRUST_HOST: "true",
      BLOB_READ_WRITE_TOKEN: "isolated-test-no-blob-access", NEXT_TELEMETRY_DISABLED: "1", CI: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  server.stdout.on("data", chunk => { serverOutput += String(chunk); });
  server.stderr.on("data", chunk => { serverOutput += String(chunk); });
  const browser = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking",
    "--no-first-run", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
  let socket: WebSocket | undefined;
  try {
    const origin = await eventually(() => {
      if (server.exitCode !== null) throw new Error(serverOutput);
      return serverOutput.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    }, "lokaler Next.js-Server");
    const portFile = join(profile, "DevToolsActivePort");
    await eventually(() => existsSync(portFile), "Chrome DevTools");
    const [port, endpoint] = readFileSync(portFile, "utf8").trim().split(/\r?\n/);
    const ws = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
    socket = ws;
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Chrome DevTools unavailable"));
    });
    let nextId = 0;
    const pending = new Map<number, { resolve: (value: Reply) => void; reject: (error: Error) => void }>();
    ws.onmessage = event => {
      const message = JSON.parse(String(event.data));
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request?.reject(new Error(message.error.message));
      else request?.resolve(message.result ?? {});
    };
    const call = (method: string, params: object = {}, session?: string) => new Promise<Reply>((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId: session }));
    });
    const { targetId } = await call("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await call("Target.attachToTarget", { targetId, flatten: true });
    async function js<T = unknown>(expression: string) {
      const response = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (response.exceptionDetails) throw new Error(response.result?.description ?? JSON.stringify(response.exceptionDetails));
      return response.result?.value as T;
    }
    async function navigate(path: string) {
      await call("Page.navigate", { url: origin + path }, sessionId);
      await eventually(() => js(`location.pathname === ${JSON.stringify(path.split("?")[0])} && document.readyState === "complete"`).catch(() => false), path);
    }
    async function contains(text: string) {
      await eventually(() => js(`document.body?.innerText.includes(${JSON.stringify(text)})`).catch(() => false), text);
    }
    async function clickButton(text: string) {
      await eventually(() => js(`(() => {
        const button = [...document.querySelectorAll("button")].find(node => node.textContent.trim() === ${JSON.stringify(text)});
        if (!button || button.disabled) return false;
        button.click();
        return true;
      })()`), text);
    }
    async function upload(bytes: Buffer, name: string) {
      await js(`(() => {
        const field = document.querySelector('input[type=file]');
        const files = new DataTransfer();
        files.items.add(new File([Uint8Array.from(atob(${JSON.stringify(bytes.toString("base64"))}), char => char.charCodeAt(0))], ${JSON.stringify(name)}));
        field.files = files.files;
        field.dispatchEvent(new Event("change", { bubbles: true }));
      })()`);
    }

    await navigate("/login");
    const signIn = await js<number>(`(async () => {
      const { csrfToken } = await (await fetch("/api/auth/csrf")).json();
      const response = await fetch("/api/auth/callback/credentials", { method: "POST",
        redirect: "manual", body: new URLSearchParams({csrfToken, email: ${JSON.stringify(fixtureEmail)}, password: ${JSON.stringify(fixturePassword)}, callbackUrl: location.origin + "/fragen"}) });
      return response.status;
    })()`);
    assert.ok([0, 200, 302].includes(signIn));
    await navigate("/fragen");
    await contains("Excel-Fragenimport");
    await navigate("/fragen/import/excel");
    await contains("Excel-Vorlage herunterladen");
    assert.equal(await js(`document.body.innerText.includes("Fremde Testreihe") || document.body.innerText.includes("Archivierte Testreihe")`), false);
    assert.equal(await js(`Boolean(document.querySelector('input[value="GLOBAL"]'))`), false);
    const files = await js<{ name: string | null; base64: string }[]>(`Promise.all(
      [...document.querySelectorAll("a")].filter(a => a.href.includes("/excel/download")).map(async a => {
        const response = await fetch(a.href);
        const bytes = new Uint8Array(await response.arrayBuffer());
        return {name: response.headers.get("content-disposition"), base64: btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""))};
      }))`);
    assert.equal(files.length, 2);
    assert.match(files[0].name ?? "", /vorlage\.xlsx/);
    assert.match(files[1].name ?? "", /beispiel\.xlsx/);
    await js(`document.querySelector('input[value="EVENT_SERIES"]').click()`);
    await eventually(() => js(`Boolean(document.querySelector('input[type="checkbox"]'))`), "Eventreihenauswahl");
    await js(`document.querySelector('input[type="checkbox"]').click()`);
    await upload(fixtureWorkbook({ Fragen: [["O", "Offen", "Kategorie", "", "Unbekannte Kategorie"]], Antworten: [["O", "Text"]] }), "fehler.xlsx");
    await clickButton("Datei prüfen");
    await contains("Unbekannte Kategorie");
    assert.ok(await js(`document.body.innerText.includes("Fragen · Zeile 2 · Kategorien")`));
    assert.equal(await db.fragen.count(), 0);
    await upload(Buffer.from(files[1].base64, "base64"), "beispiel.xlsx");
    await clickButton("Datei prüfen");
    await contains("Vorschau · 6 Fragen");
    for (const text of ["Excel Testreihe", "Sagarmatha", "Volt", "Griechenland", "Athen", "Stoffmenge", "Mol"]) await contains(text);
    assert.equal(await db.fragen.count(), 0);
    await js(`(() => {
      const button = [...document.querySelectorAll("button")].find(node => node.textContent.includes("6 Fragen als Entwürfe importieren"));
      button.click(); button.click();
    })()`);
    await contains("6 Entwürfe angelegt");
    assert.equal(await db.fragen.count(), 6);
    assert.equal(await db.excel_question_import_receipts.count(), 1);
    const resultLinks = await js<string[]>(`[...document.querySelectorAll('[role=status] a')].map(link => new URL(link.href).pathname)`);
    assert.equal(resultLinks.length, 6);
    await navigate(resultLinks[0]);
    await eventually(() => js(`[...document.querySelectorAll("input,textarea")].some(field => field.value === "Sagarmatha")`), "Schreibvariante im wieder geöffneten Editor");
    await navigate(resultLinks[2]);
    await eventually(() => js(`[...document.querySelectorAll("input,textarea")].some(field => field.value === "Volt")`), "Einfachauswahl im wieder geöffneten Editor");
    await navigate(resultLinks[5]);
    await eventually(() => js(`document.querySelector('input[aria-label="Paar 4, rechts"]')?.value === "Mol"`), "Paar im wieder geöffneten Editor");

    const id = Number(resultLinks[5].split("/").pop());
    const loaded = await loadQuestionForEditor(id, db);
    const pairs = loaded?.draft.templateConfig.templateData;
    assert.ok(pairs?.kind === "PAIRS");
    // The unchanged draft must be approvable without manufacturing a classic answer.
    await fixture.sql.query("UPDATE pubquiz.benutzer_reihenrollen SET rolle='EVENT_MANAGER' WHERE benutzer_id=1 AND eventreihe_id=10");
    await navigate(resultLinks[5]);
    await clickButton("Gespeicherten Inhalt freigeben");
    await contains("Gespeicherter Inhalt freigegeben.");
    const approved = await loadQuestionForEditor(id, db);
    assert.equal(approved?.access.reviewStatus, "APPROVED");
    assert.equal(approved?.record.approvedByName, "Excel Editor");
    assert.deepEqual(approved?.draft.templateConfig.templateData, pairs);
    assert.deepEqual(approved?.draft.answers, []);
    assert.equal(await db.antworten.count({ where: { fragen_id: id } }), 0);
    const quiz = await db.quiz.create({ data: { titel: "Excel Browser-Quiz", eventreihe_id: 10 } });
    const quizId = quiz.quiz_id;
    const block = await db.quiz_abschnitte.create({ data: { quiz_id: quizId, titel: "Testblock", sortierung: 1, abschnitt_typ: "fragenblock" } });
    const assignment = await db.quiz_fragen.create({ data: { quiz_id: quizId, fragen_id: id,
      quiz_abschnitt_id: block.quiz_abschnitt_id, sortierung: 1, punkte_basis: 1 } });
    const assignmentId = assignment.quiz_fragen_id;
    const classic = await Promise.all([0, 2].map(async index => {
      const questionId = Number(resultLinks[index].split("/").pop());
      const assigned = await db.quiz_fragen.create({ data: { quiz_id: quizId, fragen_id: questionId,
        quiz_abschnitt_id: block.quiz_abschnitt_id, sortierung: index + 2 } });
      const options = await db.antworten.findMany({ where: { fragen_id: questionId }, orderBy: { antwort_id: "asc" } });
      return { id: assigned.quiz_fragen_id, interaction: index === 0
        ? { type: "TEXT", multiline: true, inputMode: "text", placeholder: "Antwort eintragen..." }
        : { type: "SINGLE_CHOICE", selectionMode: "SINGLE", options: options.map(row => ({ id: row.antwort_id, label: row.antwort })) } };
    }));
    const now = new Date();
    await db.quiz_praesentation_status.create({ data: { quiz_id: quizId, quiz_started_at: now,
      slide_key: `question:${assignmentId}:question`, slide_index: 1 } });
    await db.quiz_block_freigaben.create({ data: { quiz_id: quizId, quiz_abschnitt_id: block.quiz_abschnitt_id,
      ist_freigegeben: true, freigegeben_ab: now, aktuelle_quiz_fragen_id: assignmentId } });
    await db.quiz_interaction_runs.create({ data: { quiz_id: quizId, quiz_fragen_id: assignmentId,
      interaction_type: "MATCHING", state: "OPEN", is_current: true, opened_at: now,
      config_snapshot: { interaction: { type: "MATCHING", ...pairColumns(pairs) } } } });
    const team = await db.teams.create({ data: { teamname: "Excel Browserteam", teamname_normalisiert: "excel browserteam" } });
    const participant = await db.quiz_team_sessions.create({ data: { quiz_id: quizId, team_id: team.team_id, teamname: team.teamname } });
    const browserTeamSession = { quiz_team_session_id: participant.quiz_team_session_id, teamname: team.teamname,
      teamPasswort: null, sessionToken: issueTeamSessionToken({ quizId, sessionId: participant.quiz_team_session_id }, fixtureSecret) };
    await js(`localStorage.setItem("quiz-session-${quizId}", ${JSON.stringify(JSON.stringify(browserTeamSession))})`);
    await navigate(`/quiz/${quizId}/antworten`);
    await eventually(() => js(`document.querySelector('[data-answer-interaction="MATCHING"]')?.textContent.includes("Stoffmenge")`), "Paarfrage im Team-Antwortformular");

    await navigate(`/quiz/${quizId}/praesentation`);
    await eventually(() => js(`Boolean(document.querySelector('[data-pairs-slide="question"]'))`), "Paarfrage in der Präsentation");
    assert.equal(await js(`Boolean(document.querySelector('[data-pairs-slide="solution"]'))`), false);
    await db.quiz_praesentation_status.update({ where: { quiz_id: quizId },
      data: { slide_key: `question:${assignmentId}:solution`, slide_index: 2 } });
    await navigate(`/quiz/${quizId}/moderation`);
    await contains("Stoffmenge");
    await navigate(`/quiz/${quizId}/praesentation`);
    await eventually(() => js(`[...document.querySelectorAll('[data-pairs-slide="solution"] .grid')].some(row => row.textContent.trim() === "StoffmengeMol")`), "gespeicherte Paarzuordnung auf der Auflösungsfolie");

    for (const [index, question] of classic.entries()) {
      await db.quiz_interaction_runs.updateMany({ where: { quiz_id: quizId }, data: { state: "CLOSED", is_current: false, is_hidden: true } });
      await db.quiz_interaction_runs.create({ data: { quiz_id: quizId, quiz_fragen_id: question.id,
        interaction_type: question.interaction.type, state: "OPEN", is_current: true, opened_at: new Date(),
        config_snapshot: { interaction: question.interaction } } });
      await db.quiz_praesentation_status.update({ where: { quiz_id: quizId },
        data: { slide_key: `question:${question.id}:question` } });
      const solution = index === 0 ? "Sagarmatha" : "Volt";
      const questionText = index === 0 ? "höchste Berg" : "elektrische Spannung";
      await navigate(`/quiz/${quizId}/antworten`);
      await eventually(() => js(`Boolean(document.querySelector('[data-answer-interaction="${question.interaction.type}"]'))`), `Teamformular ${question.interaction.type}`);
      if (index === 0) assert.equal(await js(`document.body.innerText.includes("Sagarmatha")`), false);
      else await contains("Volt");
      await navigate(`/quiz/${quizId}/praesentation`);
      await contains(questionText);
      assert.equal(await js(`Boolean(document.querySelector('[data-correct="true"]'))`), false);
      await db.quiz_praesentation_status.update({ where: { quiz_id: quizId },
        data: { slide_key: `question:${question.id}:solution` } });
      await navigate(`/quiz/${quizId}/moderation`);
      await contains(solution);
      await navigate(`/quiz/${quizId}/praesentation`);
      await contains(solution);
    }
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : error}\nNext.js:\n${serverOutput.slice(-6000)}`, { cause: error });
  } finally {
    socket?.close();
    browser.kill();
    server.kill();
    await fixture.close();
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Chrome can hold its temporary profile briefly on Windows. */ }
  }
});
