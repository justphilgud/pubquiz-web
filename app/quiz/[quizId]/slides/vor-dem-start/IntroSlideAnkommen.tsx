"use client";

import { useState } from "react";

type IntroSlideAnkommenProps = {
  quizId: number;
  startzeit?: string | null;
  logoUrl?: string | null;
  qrCodeUrl?: string;
  wartetext?: string | null;
};

export function IntroSlideAnkommen({
  quizId,
  startzeit,
  logoUrl,
  qrCodeUrl,
  wartetext,
}: IntroSlideAnkommenProps) {
  const [qrCodeFehlt, setQrCodeFehlt] = useState(false);

  const finalStartzeit = startzeit?.trim() || "19:30";
  const finalWartetext =
    wartetext?.trim() ||
    "Wir warten noch auf die Les Humphries Singers.\nDann geht’s los!";

  const finalQrCodeUrl =
    qrCodeUrl?.trim() || `/medien/bilder/qr_codes/${quizId}.png`;

  const wartetextZeilen = finalWartetext.split("\n");
  const finalLogoUrl = logoUrl?.trim() || "";

  return (
    <section className="relative h-screen w-screen overflow-hidden bg-[#050510] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,245,255,0.16),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(255,0,140,0.22),transparent_40%)]" />

      <div className="absolute inset-[4vh_4vw] rounded-[2rem] border-4 border-pink-500/80 bg-black/45 p-10 shadow-[0_0_35px_rgba(255,0,150,0.9)]">
        <div className="grid h-full grid-cols-[1.1fr_0.9fr] gap-10">
          <div className="flex flex-col justify-between">
            <div className="inline-block w-fit rounded-3xl border-4 border-cyan-400/80 px-10 py-8 shadow-[0_0_35px_rgba(0,240,255,0.8)]">
              <div className="inline-flex min-h-48 w-fit min-w-80 items-center justify-center rounded-3xl border-4 border-cyan-400/80 px-10 py-8 shadow-[0_0_35px_rgba(0,240,255,0.8)]">
                {finalLogoUrl ? (
                  <img
                    src={finalLogoUrl}
                    alt="Quiz Logo"
                    className="max-h-48 max-w-[28rem] object-contain"
                  />
                ) : (
                  <div>
                    <div className="text-7xl font-black uppercase leading-none text-pink-400 drop-shadow-[0_0_18px_rgba(255,0,150,1)]">
                      Pub
                    </div>
                    <div className="text-7xl font-black uppercase leading-none text-cyan-300 drop-shadow-[0_0_18px_rgba(0,240,255,1)]">
                      Quiz
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {wartetextZeilen.map((zeile, index) => (
                <p
                  key={`${zeile}-${index}`}
                  className={
                    index === wartetextZeilen.length - 1
                      ? "-rotate-1 text-5xl font-black text-yellow-300 drop-shadow-[0_0_14px_rgba(255,230,0,1)]"
                      : "text-5xl font-extrabold leading-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                  }
                >
                  {zeile}
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-8">
            <div className="text-center">
              <p className="mb-4 text-4xl font-bold uppercase tracking-[0.18em] text-cyan-300 drop-shadow-[0_0_12px_rgba(0,240,255,1)]">
                Quiz startet um
              </p>

              <div className="rounded-3xl border-4 border-pink-500 px-16 py-6 text-8xl font-black text-pink-300 shadow-[0_0_35px_rgba(255,0,150,0.85)]">
                {finalStartzeit}
              </div>
            </div>

            <div className="flex h-72 w-72 items-center justify-center rounded-3xl border-4 border-cyan-400 bg-white p-5 shadow-[0_0_30px_rgba(0,240,255,0.9)]">
              {qrCodeFehlt ? (
                <div className="text-center text-sm font-bold text-red-600">
                  QR-Code nicht gefunden:
                  <br />
                  {finalQrCodeUrl}
                </div>
              ) : (
                <img
                  src={finalQrCodeUrl}
                  alt="QR-Code für Spiel und Infos"
                  className="h-full w-full object-contain"
                  onError={() => setQrCodeFehlt(true)}
                />
              )}
            </div>

            <p className="text-center text-3xl font-bold text-cyan-200 drop-shadow-[0_0_12px_rgba(0,240,255,1)]">
              Scan me
              <br />
              <span className="text-xl text-white">für Spiel & Infos</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}