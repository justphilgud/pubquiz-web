"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { updateIntroStartsequenz } from "@/app/quiz/actions";
import { put } from "@vercel/blob";

const STANDARD_AUDIO_URL = "/medien/audio/intro/mexico.mp3";

export async function saveStartsequenz(formData: FormData) {
  const quizId = Number(formData.get("quizId"));
  const passwort = String(formData.get("passwort") ?? "");
  const currentAudioUrl = String(formData.get("currentAudioUrl") ?? "");
  const submitAction = String(formData.get("submitAction") ?? "close");

  let audioUrl = currentAudioUrl || STANDARD_AUDIO_URL;

  const audioFile = formData.get("audioFile");

  if (audioFile instanceof File && audioFile.size > 0) {
    if (audioFile.size > 10 * 1024 * 1024) {
      throw new Error("Die Audiodatei darf maximal 10 MB groß sein.");
    }

    if (!audioFile.name.toLowerCase().endsWith(".mp3")) {
      throw new Error("Es sind nur MP3-Dateien erlaubt.");
    }

    const fileName = `intro/custom-${quizId}.mp3`;

    const blob = await put(fileName, audioFile, {
      access: "public",
      addRandomSuffix: false,
    });

    audioUrl = blob.url;

    await updateIntroStartsequenz({
      quizId,
      audioUrl,
      text: String(formData.get("text") ?? ""),
    });

    if (submitAction === "stay") {
      redirect(
        `/quiz/${quizId}/slides/startsequenz?passwort=${encodeURIComponent(
          passwort
        )}`
      );
    }

    redirect(`/quiz/${quizId}?passwort=${encodeURIComponent(passwort)}`);
  }